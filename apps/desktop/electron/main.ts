import { app, BrowserWindow, Menu, ipcMain } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { Effect } from "effect";
import { makeShowRpcWebSocketUrl } from "@showtime/contracts";
import { startBackend } from "./backend";

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
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: BrowserWindow | null;
const showRpcToken = randomBytes(32).toString("base64url");
const showRpcWebSocketUrl = makeShowRpcWebSocketUrl(showRpcToken);

function getAppIconPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "assets", "icon.png");
  }

  return path.resolve(process.env.APP_ROOT, "..", "..", "assets", "icon.png");
}

function createWindow() {
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

  // Test active push message to Renderer-process.
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  if (VITE_DEV_SERVER_URL) {
    void win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    // win.loadFile('dist/index.html')
    void win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}

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
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

void app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  ipcMain.handle("showtime:rpc-web-socket-url", () => showRpcWebSocketUrl);
  Effect.runPromise(startBackend(showRpcToken)).catch((error: unknown) => {
    console.error("Showtime backend startup failed", error);
  });
  createWindow();
});
