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
  desktopSetAppearanceChannel,
  desktopCheckForUpdatesChannel,
  desktopDownloadUpdateChannel,
  desktopInstallUpdateChannel,
  desktopUpdateStateChangedChannel,
  desktopUpdateStateChannel,
  ShowtimeConnectionInfo,
  type ShowtimeDesktopUpdateState,
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
  setAppearance: (preference) => ipcRenderer.send(desktopSetAppearanceChannel, preference),
  updateState: () => ipcRenderer.invoke(desktopUpdateStateChannel),
  checkForUpdates: () => ipcRenderer.invoke(desktopCheckForUpdatesChannel),
  downloadUpdate: () => ipcRenderer.invoke(desktopDownloadUpdateChannel),
  installUpdate: () => ipcRenderer.invoke(desktopInstallUpdateChannel),
  onUpdateState: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, state: ShowtimeDesktopUpdateState) =>
      listener(state);
    ipcRenderer.on(desktopUpdateStateChangedChannel, handler);
    return () => ipcRenderer.removeListener(desktopUpdateStateChangedChannel, handler);
  },
};

contextBridge.exposeInMainWorld("showtime", bridge);
