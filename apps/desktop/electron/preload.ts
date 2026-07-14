import { ipcRenderer, contextBridge } from "electron";
import { Schema } from "effect";
import {
  desktopConnectionsStateChannel,
  desktopCreateInvitationChannel,
  desktopPairingInfoChannel,
  desktopRemoveConnectionChannel,
  desktopRpcWebSocketUrlChannel,
  desktopSetConnectionsEnabledChannel,
  ShowtimeConnectionInfo,
  type ShowtimeHostBridge,
} from "@showtime/shared";

const bridge: ShowtimeHostBridge = {
  rpcWebSocketUrl: () => ipcRenderer.invoke(desktopRpcWebSocketUrlChannel) as Promise<string>,
  connectionsState: () => ipcRenderer.invoke(desktopConnectionsStateChannel),
  createInvitation: (name, scopes) =>
    ipcRenderer.invoke(desktopCreateInvitationChannel, name, scopes),
  pairingInfo: async (invitationId) =>
    Schema.decodeUnknownSync(ShowtimeConnectionInfo)(
      await ipcRenderer.invoke(desktopPairingInfoChannel, invitationId),
    ),
  removeConnection: (id) => ipcRenderer.invoke(desktopRemoveConnectionChannel, id),
  setConnectionsEnabled: (enabled) =>
    ipcRenderer.invoke(desktopSetConnectionsEnabledChannel, enabled),
};

contextBridge.exposeInMainWorld("showtime", bridge);
