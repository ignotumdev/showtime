import { ipcRenderer, contextBridge } from "electron";
import {
  desktopConnectionsStateChannel,
  desktopCreateInvitationChannel,
  desktopPairingInfoChannel,
  desktopRemoveConnectionChannel,
  desktopRpcWebSocketUrlChannel,
  desktopSetConnectionsEnabledChannel,
  type ShowtimeHostBridge,
} from "@showtime/shared";

const bridge: ShowtimeHostBridge = {
  rpcWebSocketUrl: () => ipcRenderer.invoke(desktopRpcWebSocketUrlChannel) as Promise<string>,
  connectionsState: () => ipcRenderer.invoke(desktopConnectionsStateChannel),
  createInvitation: (name) => ipcRenderer.invoke(desktopCreateInvitationChannel, name),
  pairingInfo: (invitationId) => ipcRenderer.invoke(desktopPairingInfoChannel, invitationId),
  removeConnection: (id) => ipcRenderer.invoke(desktopRemoveConnectionChannel, id),
  setConnectionsEnabled: (enabled) =>
    ipcRenderer.invoke(desktopSetConnectionsEnabledChannel, enabled),
};

contextBridge.exposeInMainWorld("showtime", bridge);
