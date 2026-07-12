export const desktopRpcWebSocketUrlChannel = "showtime:rpc-web-socket-url";
export const desktopConnectionsStateChannel = "showtime:connections-state";
export const desktopCreateInvitationChannel = "showtime:create-invitation";
export const desktopPairingInfoChannel = "showtime:pairing-info";
export const desktopRemoveConnectionChannel = "showtime:remove-connection";
export const desktopSetConnectionsEnabledChannel = "showtime:set-connections-enabled";
export const showtimeConnectionStorageKey = "showtime.connection.v1";

export interface ShowtimeConnectionCandidate {
  readonly address: string;
  readonly interfaceName: string;
  readonly url: string;
}

export interface ShowtimeConnectionInfo {
  readonly candidates: ReadonlyArray<ShowtimeConnectionCandidate>;
}

export interface ShowtimePendingClient {
  readonly kind: "pending";
  readonly invitationId: string;
  readonly name: string;
  readonly expiresAt: string;
}

export interface ShowtimePairedClient {
  readonly kind: "paired";
  readonly clientId: string;
  readonly name: string;
  readonly createdAt: string;
  readonly connected: boolean;
}

export type ShowtimeConnectionClient = ShowtimePendingClient | ShowtimePairedClient;

export interface ShowtimeConnectionsState {
  readonly enabled: boolean;
  readonly clients: ReadonlyArray<ShowtimeConnectionClient>;
}

export interface ShowtimeStoredConnection {
  readonly version: 1;
  readonly clientId: string;
  readonly capability: string;
}

/** Capabilities supplied by a native host. Browser clients run without this bridge. */
export interface ShowtimeHostBridge {
  readonly rpcWebSocketUrl: () => Promise<string>;
  readonly connectionsState: () => Promise<ShowtimeConnectionsState>;
  readonly createInvitation: (name: string) => Promise<ShowtimeConnectionsState>;
  readonly pairingInfo: (invitationId: string) => Promise<ShowtimeConnectionInfo>;
  readonly removeConnection: (id: string) => Promise<ShowtimeConnectionsState>;
  readonly setConnectionsEnabled: (enabled: boolean) => Promise<ShowtimeConnectionsState>;
}
