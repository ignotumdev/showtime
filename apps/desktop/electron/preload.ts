import { ipcRenderer, contextBridge } from "electron";
import { desktopRpcWebSocketUrlChannel, type ShowtimeHostBridge } from "@showtime/shared";

const bridge: ShowtimeHostBridge = {
  rpcWebSocketUrl: () => ipcRenderer.invoke(desktopRpcWebSocketUrlChannel) as Promise<string>,
};

contextBridge.exposeInMainWorld("showtime", bridge);
