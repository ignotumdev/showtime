import { ipcRenderer, contextBridge } from "electron";
import { Schema } from "effect";
import {
  desktopConnectionsStateChannel,
  desktopCreateInvitationChannel,
  desktopPairingInfoChannel,
  desktopRemoveConnectionChannel,
  desktopRpcWebSocketUrlChannel,
  desktopSetConnectionsEnabledChannel,
  desktopSetHostNameChannel,
  ShowtimeConnectionInfo,
  type ShowtimeHostBridge,
} from "@showtime/shared";

const bridge: ShowtimeHostBridge = {
  rpcWebSocketUrl: () => ipcRenderer.invoke(desktopRpcWebSocketUrlChannel) as Promise<string>,
  connectionsState: () => ipcRenderer.invoke(desktopConnectionsStateChannel),
  createInvitation: (name, clientProfile, scopes) =>
    ipcRenderer.invoke(desktopCreateInvitationChannel, name, clientProfile, scopes),
  pairingInfo: async (invitationId) =>
    Schema.decodeUnknownSync(ShowtimeConnectionInfo)(
      await ipcRenderer.invoke(desktopPairingInfoChannel, invitationId),
    ),
  removeConnection: (id) => ipcRenderer.invoke(desktopRemoveConnectionChannel, id),
  setConnectionsEnabled: (enabled) =>
    ipcRenderer.invoke(desktopSetConnectionsEnabledChannel, enabled),
  setHostName: (hostName) => ipcRenderer.invoke(desktopSetHostNameChannel, hostName),
};

contextBridge.exposeInMainWorld("showtime", bridge);
