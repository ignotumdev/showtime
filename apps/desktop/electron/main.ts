import { app, BrowserWindow, Menu, dialog, ipcMain } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Effect } from "effect";
import { ConnectionManager, makeBackendRuntime } from "@showtime/backend";
import {
  desktopConnectionsStateChannel,
  desktopCreateInvitationChannel,
  desktopPairingInfoChannel,
  desktopRemoveConnectionChannel,
  desktopRpcWebSocketUrlChannel,
  desktopSetConnectionsEnabledChannel,
} from "@showtime/shared";

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
const rpcPort = 34987;
const backendRuntime = makeBackendRuntime({
  host: rpcHost,
  port: rpcPort,
  webRoot: RENDERER_DIST,
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
        ipcMain.handle(desktopCreateInvitationChannel, (_event, name: string) =>
          backendRuntime.runPromise(
            Effect.flatMap(ConnectionManager, (_) => _.createInvitation(name)),
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
        backendStarted = true;
        createWindow();
      })
      .catch((error: unknown) => {
        console.error("Showtime backend startup failed", error);
        dialog.showErrorBox(
          "Showtime could not start",
          "The local Showtime backend could not start. Please close other Showtime windows and try again.",
        );
        app.quit();
      });
  });
}
