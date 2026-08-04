import { EventEmitter } from "node:events";
import type { AppUpdater, UpdateInfo } from "electron-updater";
import { describe, expect, it, vi } from "vite-plus/test";
import { DesktopUpdateService, type DesktopUpdateServiceOptions } from "./DesktopUpdateService.js";

const updateInfo = {
  version: "0.2.0",
  files: [],
  path: "Showtime.exe",
  sha512: "checksum",
  releaseDate: "2026-08-03T00:00:00.000Z",
  releaseNotes: "Safer updates",
} as UpdateInfo;

class FakeUpdater extends EventEmitter {
  autoDownload = true;
  autoInstallOnAppQuit = true;
  readonly checkForUpdates = vi.fn(async () => {
    this.emit("update-available", updateInfo);
    return null;
  });
  readonly downloadUpdate = vi.fn(async () => {
    this.emit("update-downloaded", updateInfo);
    return [];
  });
  readonly quitAndInstall = vi.fn();
}

const setup = (overrides: Partial<DesktopUpdateServiceOptions> = {}) => {
  const updater = new FakeUpdater();
  const states: Array<ReturnType<DesktopUpdateService["state"]>> = [];
  const options: DesktopUpdateServiceOptions = {
    currentVersion: "0.1.0",
    packaged: true,
    hasActiveLiveSessions: async () => false,
    beginMaintenance: async () => true,
    endMaintenance: async () => undefined,
    prepareForUpdate: async () => undefined,
    publish: (state) => states.push(state),
    ...overrides,
  };
  const service = new DesktopUpdateService(options, updater as unknown as AppUpdater);
  return { options, service, states, updater };
};

describe("DesktopUpdateService", () => {
  it("checks on request without automatically downloading", async () => {
    const { service, updater } = setup();

    await service.check();

    expect(updater.autoDownload).toBe(false);
    expect(updater.autoInstallOnAppQuit).toBe(false);
    expect(updater.checkForUpdates).toHaveBeenCalledOnce();
    expect(updater.downloadUpdate).not.toHaveBeenCalled();
    expect(service.state()).toMatchObject({ kind: "available", version: "0.2.0" });
  });

  it("refuses a manual download while any show is Live", async () => {
    const { service, updater } = setup({ hasActiveLiveSessions: async () => true });
    await service.check();

    await service.download();

    expect(updater.downloadUpdate).not.toHaveBeenCalled();
    expect(service.state()).toMatchObject({ kind: "blocked-live", action: "download" });
  });

  it("fails closed when the Live guard is unavailable", async () => {
    const { service, updater } = setup({
      hasActiveLiveSessions: async () => Promise.reject(new Error("backend unavailable")),
    });
    await service.check();

    await service.download();

    expect(updater.downloadUpdate).not.toHaveBeenCalled();
    expect(service.state()).toMatchObject({ kind: "blocked-live", action: "download" });
  });

  it("never treats a download block as an installable update", async () => {
    const beginMaintenance = vi.fn(async () => true);
    const { service, updater } = setup({
      hasActiveLiveSessions: async () => true,
      beginMaintenance,
    });
    await service.check();
    await service.download();

    await service.install();

    expect(beginMaintenance).not.toHaveBeenCalled();
    expect(updater.quitAndInstall).not.toHaveBeenCalled();
  });

  it("downloads and installs only through separate explicit calls", async () => {
    const prepareForUpdate = vi.fn(async () => undefined);
    const { service, updater } = setup({ prepareForUpdate });
    await service.check();

    await service.download();
    expect(service.state()).toMatchObject({ kind: "ready", version: "0.2.0" });
    expect(updater.quitAndInstall).not.toHaveBeenCalled();

    await service.install();
    expect(prepareForUpdate).toHaveBeenCalledOnce();
    expect(updater.quitAndInstall).toHaveBeenCalledWith(false, true);
  });

  it("does not start a second download while the first request is pending", async () => {
    let resolveDownload: (() => void) | undefined;
    const { service, updater } = setup();
    updater.downloadUpdate.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveDownload = () => {
            updater.emit("update-downloaded", updateInfo);
            resolve([]);
          };
        }),
    );
    await service.check();

    const first = service.download();
    const second = service.download();
    await second;

    expect(updater.downloadUpdate).toHaveBeenCalledOnce();
    expect(service.state()).toMatchObject({ kind: "downloading", version: "0.2.0" });

    resolveDownload?.();
    await first;
    expect(service.state()).toMatchObject({ kind: "ready", version: "0.2.0" });
  });

  it("does not let a concurrent install request replace the active install state", async () => {
    let resolveMaintenance: ((started: boolean) => void) | undefined;
    const beginMaintenance = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveMaintenance = resolve;
        }),
    );
    const prepareForUpdate = vi.fn(async () => undefined);
    const { service, updater } = setup({ beginMaintenance, prepareForUpdate });
    await service.check();
    await service.download();

    const first = service.install();
    const second = service.install();
    await second;

    expect(beginMaintenance).toHaveBeenCalledOnce();
    expect(service.state()).toMatchObject({ kind: "ready", version: "0.2.0" });

    resolveMaintenance?.(true);
    await first;
    expect(prepareForUpdate).toHaveBeenCalledOnce();
    expect(updater.quitAndInstall).toHaveBeenCalledOnce();
  });

  it("releases the install reservation when maintenance cannot start", async () => {
    const beginMaintenance = vi
      .fn<DesktopUpdateServiceOptions["beginMaintenance"]>()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const { service, updater } = setup({ beginMaintenance });
    await service.check();
    await service.download();

    await service.install();
    expect(service.state()).toMatchObject({ kind: "blocked-live", action: "install" });

    await service.install();
    expect(beginMaintenance).toHaveBeenCalledTimes(2);
    expect(updater.quitAndInstall).toHaveBeenCalledOnce();
  });

  it("offers an install retry without downloading again when installation throws", async () => {
    const endMaintenance = vi.fn(async () => undefined);
    const { service, updater } = setup({ endMaintenance });
    updater.quitAndInstall.mockImplementationOnce(() => {
      throw new Error("quit failed");
    });
    await service.check();
    await service.download();

    await service.install();

    expect(endMaintenance).toHaveBeenCalledOnce();
    expect(service.state()).toMatchObject({ kind: "error", retry: "install", version: "0.2.0" });

    await service.install();
    expect(updater.quitAndInstall).toHaveBeenCalledTimes(2);
    expect(updater.downloadUpdate).toHaveBeenCalledOnce();
  });

  it("releases maintenance and offers an install retry for updater error events", async () => {
    const endMaintenance = vi.fn(async () => undefined);
    const { service, updater } = setup({ endMaintenance });
    updater.quitAndInstall.mockImplementationOnce(() => {
      updater.emit("error", new Error("installer launch failed"));
    });
    await service.check();
    await service.download();

    await service.install();
    await vi.waitFor(() => {
      expect(service.state()).toMatchObject({
        kind: "error",
        retry: "install",
        version: "0.2.0",
      });
    });

    expect(endMaintenance).toHaveBeenCalledOnce();
    expect(updater.downloadUpdate).toHaveBeenCalledOnce();
  });

  it("does not offer an install retry when maintenance cleanup fails", async () => {
    const beginMaintenance = vi.fn(async () => true);
    const endMaintenance = vi.fn(async () => Promise.reject(new Error("backend unavailable")));
    const { service, updater } = setup({ beginMaintenance, endMaintenance });
    updater.quitAndInstall.mockImplementationOnce(() => {
      throw new Error("quit failed");
    });
    await service.check();
    await service.download();

    await service.install();

    expect(endMaintenance).toHaveBeenCalledOnce();
    expect(service.state()).toMatchObject({
      kind: "recovery-required",
      version: "0.2.0",
      message: expect.stringContaining("Restart Showtime"),
    });

    await service.install();
    expect(beginMaintenance).toHaveBeenCalledOnce();
    expect(updater.quitAndInstall).toHaveBeenCalledOnce();
  });
});
