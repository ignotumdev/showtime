export const desktopUpdateStateChannel = "showtime:update-state";
export const desktopCheckForUpdatesChannel = "showtime:check-for-updates";
export const desktopDownloadUpdateChannel = "showtime:download-update";
export const desktopInstallUpdateChannel = "showtime:install-update";
export const desktopUpdateStateChangedChannel = "showtime:update-state-changed";

export interface ShowtimeUpdateVersionInfo {
  readonly version: string;
  readonly releaseDate?: string;
  readonly releaseNotes?: string;
}

export type ShowtimeDesktopUpdateState =
  | { readonly kind: "unsupported"; readonly currentVersion: string }
  | { readonly kind: "checking"; readonly currentVersion: string }
  | { readonly kind: "up-to-date"; readonly currentVersion: string }
  | ({ readonly kind: "available"; readonly currentVersion: string } & ShowtimeUpdateVersionInfo)
  | ({
      readonly kind: "downloading";
      readonly currentVersion: string;
      readonly percent: number;
      readonly bytesPerSecond: number;
      readonly transferred: number;
      readonly total: number;
    } & ShowtimeUpdateVersionInfo)
  | ({ readonly kind: "ready"; readonly currentVersion: string } & ShowtimeUpdateVersionInfo)
  | ({
      readonly kind: "blocked-live";
      readonly currentVersion: string;
      readonly action: "download" | "install";
    } & Partial<ShowtimeUpdateVersionInfo>)
  | {
      readonly kind: "error";
      readonly currentVersion: string;
      readonly message: string;
      readonly retry: "check" | "download";
      readonly version?: string;
    };
