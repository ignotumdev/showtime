import electronUpdater, {
  CancellationToken,
  type AppUpdater,
  type ProgressInfo,
  type UpdateInfo,
} from "electron-updater";
import type { ShowtimeDesktopUpdateState, ShowtimeUpdateVersionInfo } from "@showtime/shared";

export interface DesktopUpdateServiceOptions {
  readonly currentVersion: string;
  readonly packaged: boolean;
  readonly hasActiveLiveSessions: () => Promise<boolean>;
  readonly beginMaintenance: () => Promise<boolean>;
  readonly endMaintenance: () => Promise<void>;
  readonly prepareForUpdate: () => Promise<void>;
  readonly publish: (state: ShowtimeDesktopUpdateState) => void;
}

const releaseNotesText = (notes: UpdateInfo["releaseNotes"]): string | undefined => {
  if (typeof notes === "string") return notes;
  if (!notes || notes.length === 0) return undefined;
  return notes.map(({ version, note }) => [version, note].filter(Boolean).join("\n")).join("\n\n");
};

const versionInfo = (info: UpdateInfo): ShowtimeUpdateVersionInfo => ({
  version: info.version,
  ...(info.releaseDate ? { releaseDate: info.releaseDate } : {}),
  ...(releaseNotesText(info.releaseNotes)
    ? { releaseNotes: releaseNotesText(info.releaseNotes) }
    : {}),
});

const messageFor = (action: "check" | "download") =>
  action === "check"
    ? "Showtime could not check for updates. The installed version is still ready to use."
    : "Showtime could not download the update. Nothing was installed.";

export class DesktopUpdateService {
  readonly #updater: AppUpdater;
  readonly #options: DesktopUpdateServiceOptions;
  #state: ShowtimeDesktopUpdateState;
  #available?: ShowtimeUpdateVersionInfo;
  #downloadCancellation?: CancellationToken;
  #downloadGuardTimer?: ReturnType<typeof setInterval>;
  #downloadInProgress = false;
  #installInProgress = false;
  #installRecovery?: Promise<void>;
  #cancelledForLive = false;

  constructor(options: DesktopUpdateServiceOptions, updater = electronUpdater.autoUpdater) {
    this.#options = options;
    this.#updater = updater;
    this.#state = options.packaged
      ? { kind: "checking", currentVersion: options.currentVersion }
      : { kind: "unsupported", currentVersion: options.currentVersion };

    if (!options.packaged) return;

    this.#updater.autoDownload = false;
    this.#updater.autoInstallOnAppQuit = false;
    this.#updater.on("checking-for-update", () =>
      this.#setState({ kind: "checking", currentVersion: options.currentVersion }),
    );
    this.#updater.on("update-not-available", () => {
      this.#available = undefined;
      this.#setState({ kind: "up-to-date", currentVersion: options.currentVersion });
    });
    this.#updater.on("update-available", (info) => {
      this.#available = versionInfo(info);
      this.#setState({
        kind: "available",
        currentVersion: options.currentVersion,
        ...this.#available,
      });
    });
    this.#updater.on("download-progress", (progress) => this.#onDownloadProgress(progress));
    this.#updater.on("update-downloaded", (info) => {
      this.#stopDownloadGuard();
      this.#available = versionInfo(info);
      this.#setState({ kind: "ready", currentVersion: options.currentVersion, ...this.#available });
    });
    this.#updater.on("update-cancelled", () => {
      this.#stopDownloadGuard();
      if (this.#cancelledForLive) this.#setBlocked("download");
    });
    this.#updater.on("error", () => {
      this.#stopDownloadGuard();
      if (this.#installInProgress) {
        void this.#recoverFromInstallFailure();
        return;
      }
      if (this.#cancelledForLive) {
        this.#setBlocked("download");
        return;
      }
      const retry = this.#available ? "download" : "check";
      this.#setState({
        kind: "error",
        currentVersion: options.currentVersion,
        message: messageFor(retry),
        retry,
        ...(this.#available ? { version: this.#available.version } : {}),
      });
    });
  }

  state(): ShowtimeDesktopUpdateState {
    return this.#state;
  }

  async check(): Promise<ShowtimeDesktopUpdateState> {
    if (!this.#options.packaged) return this.#state;
    this.#available = undefined;
    this.#setState({ kind: "checking", currentVersion: this.#options.currentVersion });
    try {
      await this.#updater.checkForUpdates();
    } catch {
      this.#setState({
        kind: "error",
        currentVersion: this.#options.currentVersion,
        message: messageFor("check"),
        retry: "check",
      });
    }
    return this.#state;
  }

  async download(): Promise<ShowtimeDesktopUpdateState> {
    if (!this.#options.packaged || !this.#available || this.#downloadInProgress) {
      return this.#state;
    }

    this.#downloadInProgress = true;
    try {
      let liveSessionActive = true;
      try {
        liveSessionActive = await this.#options.hasActiveLiveSessions();
      } catch {
        // Fail closed: an unavailable guard must never allow update work to start.
      }
      if (liveSessionActive) {
        this.#setBlocked("download");
        return this.#state;
      }

      this.#cancelledForLive = false;
      this.#downloadCancellation = new CancellationToken();
      this.#setState({
        kind: "downloading",
        currentVersion: this.#options.currentVersion,
        ...this.#available,
        percent: 0,
        bytesPerSecond: 0,
        transferred: 0,
        total: 0,
      });
      this.#downloadGuardTimer = setInterval(() => {
        void this.#options
          .hasActiveLiveSessions()
          .then((active) => {
            if (!active || !this.#downloadCancellation) return;
            this.#cancelledForLive = true;
            this.#downloadCancellation.cancel();
          })
          .catch(() => {
            // Losing the guard is treated like Live starting: stop the download.
            if (!this.#downloadCancellation) return;
            this.#cancelledForLive = true;
            this.#downloadCancellation.cancel();
          });
      }, 1_000);

      try {
        await this.#updater.downloadUpdate(this.#downloadCancellation);
      } catch {
        if (this.#cancelledForLive) this.#setBlocked("download");
        else {
          this.#setState({
            kind: "error",
            currentVersion: this.#options.currentVersion,
            message: messageFor("download"),
            retry: "download",
            version: this.#available.version,
          });
        }
      } finally {
        this.#stopDownloadGuard();
      }
    } finally {
      this.#downloadInProgress = false;
    }
    return this.#state;
  }

  async install(): Promise<ShowtimeDesktopUpdateState> {
    const installable =
      this.#state.kind === "ready" ||
      (this.#state.kind === "blocked-live" && this.#state.action === "install") ||
      (this.#state.kind === "error" && this.#state.retry === "install");
    if (!installable || !this.#available || this.#installInProgress) return this.#state;

    let maintenanceStarted = false;
    try {
      maintenanceStarted = await this.#options.beginMaintenance();
    } catch {
      // Fail closed if the backend cannot prove that no Live session is active.
    }
    if (!maintenanceStarted) {
      this.#setBlocked("install");
      return this.#state;
    }

    this.#installInProgress = true;
    try {
      await this.#options.prepareForUpdate();
      this.#updater.quitAndInstall(false, true);
    } catch {
      await this.#recoverFromInstallFailure();
    }
    return this.#state;
  }

  #recoverFromInstallFailure(): Promise<void> {
    if (this.#installRecovery) return this.#installRecovery;

    this.#installRecovery = this.#options
      .endMaintenance()
      .catch(() => undefined)
      .then(() => {
        this.#installInProgress = false;
        this.#setState({
          kind: "error",
          currentVersion: this.#options.currentVersion,
          message: "Showtime could not install the update. The app is still running normally.",
          retry: "install",
          ...(this.#available ? { version: this.#available.version } : {}),
        });
      })
      .finally(() => {
        this.#installRecovery = undefined;
      });
    return this.#installRecovery;
  }

  #onDownloadProgress(progress: ProgressInfo) {
    if (!this.#available) return;
    this.#setState({
      kind: "downloading",
      currentVersion: this.#options.currentVersion,
      ...this.#available,
      percent: Math.max(0, Math.min(100, progress.percent)),
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    });
  }

  #setBlocked(action: "download" | "install") {
    this.#setState({
      kind: "blocked-live",
      currentVersion: this.#options.currentVersion,
      action,
      ...this.#available,
    });
  }

  #stopDownloadGuard() {
    if (this.#downloadGuardTimer !== undefined) clearInterval(this.#downloadGuardTimer);
    this.#downloadGuardTimer = undefined;
    this.#downloadCancellation = undefined;
  }

  #setState(state: ShowtimeDesktopUpdateState) {
    this.#state = state;
    this.#options.publish(state);
  }
}
