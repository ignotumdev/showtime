import { app, BrowserWindow, Menu, dialog, ipcMain } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Effect, Schema } from "effect";
import { ConnectionManager, LiveGuard, makeBackendRuntime } from "@showtime/backend";
import {
  desktopCheckForUpdatesChannel,
  desktopConnectionsStateChannel,
  desktopCreateInvitationChannel,
  desktopDownloadUpdateChannel,
  desktopInstallUpdateChannel,
  desktopPairingInfoChannel,
  desktopRemoveConnectionChannel,
  desktopRpcWebSocketUrlChannel,
  desktopSetConnectionsEnabledChannel,
  desktopSetHostNameChannel,
  desktopUpdateStateChangedChannel,
  desktopUpdateStateChannel,
  ShowtimeHostName,
  showtimeLocalPort,
  type ShowtimeConnectionScope,
} from "@showtime/shared";
import { formatStartupError } from "./startup-error.js";
import { DesktopUpdateService } from "./DesktopUpdateService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, "..");

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = app.isPackaged
  ? path.join(process.resourcesPath, "web")
  : path.resolve(process.env.APP_ROOT, "../web/dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: BrowserWindow | null;
let backendStarted = false;
let backendShutdownStarted = false;
const rpcHost = "0.0.0.0";
const rpcPort = showtimeLocalPort;
const backendRuntime = makeBackendRuntime({
  host: rpcHost,
  port: rpcPort,
  webRoot: RENDERER_DIST,
  localDiscovery: true,
});
const updateService = new DesktopUpdateService({
  currentVersion: app.getVersion(),
  packaged: app.isPackaged,
  hasActiveLiveSessions: () =>
    backendRuntime.runPromise(Effect.flatMap(LiveGuard, (_) => _.hasActiveSessions)),
  beginMaintenance: () =>
    backendRuntime.runPromise(Effect.flatMap(LiveGuard, (_) => _.beginMaintenance)),
  endMaintenance: () =>
    backendRuntime.runPromise(Effect.flatMap(LiveGuard, (_) => _.endMaintenance)),
  // The before-quit handler owns backend shutdown. Keeping preparation side-effect free
  // ensures a synchronous quitAndInstall failure cannot strand the running app without RPC.
  prepareForUpdate: async () => undefined,
  publish: (state) => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send(desktopUpdateStateChangedChannel, state);
    }
  },
});

function getAppIconPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "assets", "icon.png");
  }

  return path.resolve(process.env.APP_ROOT, "..", "..", "assets", "icon.png");
}

function createWindow() {
  if (win && !win.isDestroyed()) {
    win.focus();
    return;
  }

  win = new BrowserWindow({
    autoHideMenuBar: true,
    icon: getAppIconPath(),
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#0a0a0a",
      symbolColor: "#fafafa",
      height: 40,
    },
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
    },
  });

  win.setMenu(null);

  if (VITE_DEV_SERVER_URL) {
    void win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    // win.loadFile('dist/index.html')
    void win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
}

app.on("second-instance", () => {
  if (win && !win.isDestroyed()) {
    if (win.isMinimized()) {
      win.restore();
    }
    win.focus();
  }
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (backendStarted && BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("before-quit", (event) => {
  if (!backendStarted || backendShutdownStarted) return;

  event.preventDefault();
  backendShutdownStarted = true;
  void backendRuntime.dispose().finally(() => {
    backendStarted = false;
    app.quit();
  });
});

if (gotSingleInstanceLock) {
  void app.whenReady().then(() => {
    Menu.setApplicationMenu(null);

    backendRuntime
      .runPromise(Effect.void)
      .then(() => {
        ipcMain.handle(desktopRpcWebSocketUrlChannel, () =>
          backendRuntime.runPromise(
            Effect.flatMap(ConnectionManager, (connections) => connections.rpcWebSocketUrl),
          ),
        );
        ipcMain.handle(desktopConnectionsStateChannel, () =>
          backendRuntime.runPromise(Effect.flatMap(ConnectionManager, (_) => _.connectionsState)),
        );
        ipcMain.handle(
          desktopCreateInvitationChannel,
          (
            _event,
            name: string | undefined,
            clientProfile: string,
            scopes: ReadonlyArray<ShowtimeConnectionScope>,
          ) =>
            backendRuntime.runPromise(
              Effect.flatMap(ConnectionManager, (_) =>
                _.createInvitation(name, clientProfile, scopes),
              ),
            ),
        );
        ipcMain.handle(desktopPairingInfoChannel, (_event, invitationId: string) =>
          backendRuntime.runPromise(
            Effect.flatMap(ConnectionManager, (_) => _.pairingInfo(invitationId)),
          ),
        );
        ipcMain.handle(desktopRemoveConnectionChannel, (_event, id: string) =>
          backendRuntime.runPromise(
            Effect.flatMap(ConnectionManager, (_) => _.removeConnection(id)),
          ),
        );
        ipcMain.handle(desktopSetConnectionsEnabledChannel, (_event, enabled: boolean) =>
          backendRuntime.runPromise(
            Effect.flatMap(ConnectionManager, (_) => _.setConnectionsEnabled(enabled)),
          ),
        );
        ipcMain.handle(desktopSetHostNameChannel, (_event, hostName: unknown) =>
          backendRuntime.runPromise(
            Effect.flatMap(ConnectionManager, (_) =>
              _.setHostName(Schema.decodeUnknownSync(ShowtimeHostName)(hostName)),
            ),
          ),
        );
        ipcMain.handle(desktopUpdateStateChannel, () => updateService.state());
        ipcMain.handle(desktopCheckForUpdatesChannel, () => updateService.check());
        ipcMain.handle(desktopDownloadUpdateChannel, () => updateService.download());
        ipcMain.handle(desktopInstallUpdateChannel, () => updateService.install());
        backendStarted = true;
        createWindow();
        void updateService.check();
      })
      .catch((error: unknown) => {
        console.error("Showtime backend startup failed", error);
        dialog.showErrorBox(
          "Showtime could not start",
          `The local Showtime backend could not start.\n\n${formatStartupError(error)}`,
        );
        app.quit();
      });
  });
}
