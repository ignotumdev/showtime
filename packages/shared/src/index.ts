export const desktopRpcWebSocketUrlChannel = "showtime:rpc-web-socket-url";
export const desktopConnectionsStateChannel = "showtime:connections-state";
export const desktopCreateInvitationChannel = "showtime:create-invitation";
export const desktopPairingInfoChannel = "showtime:pairing-info";
export const desktopRemoveConnectionChannel = "showtime:remove-connection";
export const desktopSetConnectionsEnabledChannel = "showtime:set-connections-enabled";
export const showtimeConnectionStorageKey = "showtime.connection.v1";
export * from "./local-endpoint.js";

import { Schema } from "effect";
import { ShowtimeHostnameLabel } from "./local-endpoint.js";

export const showtimeConnectionScopes = [
  "connections:read",
  "connections:create",
  "connections:delete",
] as const;
export const ShowtimeConnectionScope = Schema.Literals(showtimeConnectionScopes);
export type ShowtimeConnectionScope = typeof ShowtimeConnectionScope.Type;
export const ShowtimeConnectionScopes = Schema.Array(ShowtimeConnectionScope);
export const showtimeConnectionManagementScopes: ReadonlyArray<ShowtimeConnectionScope> =
  showtimeConnectionScopes;

export const hasShowtimeConnectionScope = (
  scopes: ReadonlyArray<ShowtimeConnectionScope>,
  required: ShowtimeConnectionScope,
) => scopes.includes(required);

export const hasShowtimeConnectionManagementScopes = (
  scopes: ReadonlyArray<ShowtimeConnectionScope>,
) => showtimeConnectionManagementScopes.every((scope) => scopes.includes(scope));

export const ShowtimeLocalDiscoveryState = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("disabled") }),
  Schema.Struct({ kind: Schema.Literal("probing") }),
  Schema.Struct({ kind: Schema.Literal("announced"), hostname: Schema.String }),
  Schema.Struct({
    kind: Schema.Literal("degraded"),
    reason: Schema.Literal("network-unavailable"),
  }),
]);
export type ShowtimeLocalDiscoveryState = typeof ShowtimeLocalDiscoveryState.Type;

export const ShowtimeHostnameConnectionCandidate = Schema.Struct({
  kind: Schema.Literal("hostname"),
  label: Schema.String,
  host: Schema.String,
  hostnameLabel: ShowtimeHostnameLabel,
  url: Schema.String,
});
export type ShowtimeHostnameConnectionCandidate = typeof ShowtimeHostnameConnectionCandidate.Type;

export const ShowtimeIpConnectionCandidate = Schema.Struct({
  kind: Schema.Literal("ip-address"),
  label: Schema.String,
  host: Schema.String,
  interfaceName: Schema.String,
  url: Schema.String,
});
export type ShowtimeIpConnectionCandidate = typeof ShowtimeIpConnectionCandidate.Type;

export const ShowtimeConnectionCandidate = Schema.Union([
  ShowtimeHostnameConnectionCandidate,
  ShowtimeIpConnectionCandidate,
]);
export type ShowtimeConnectionCandidate = typeof ShowtimeConnectionCandidate.Type;

export const ShowtimeConnectionInfo = Schema.Struct({
  discovery: ShowtimeLocalDiscoveryState,
  candidates: Schema.Array(ShowtimeConnectionCandidate),
  expiresAt: Schema.NullOr(Schema.String),
});
export type ShowtimeConnectionInfo = typeof ShowtimeConnectionInfo.Type;

export interface ShowtimePendingClient {
  readonly kind: "pending";
  readonly invitationId: string;
  readonly name: string;
  readonly expiresAt: string;
  readonly scopes: ReadonlyArray<ShowtimeConnectionScope>;
}

export interface ShowtimePairedClient {
  readonly kind: "paired";
  readonly clientId: string;
  readonly name: string;
  readonly createdAt: string;
  readonly connected: boolean;
  readonly scopes: ReadonlyArray<ShowtimeConnectionScope>;
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
  readonly scopes: ReadonlyArray<ShowtimeConnectionScope>;
}

/** Capabilities supplied by a native host. Browser clients run without this bridge. */
export interface ShowtimeHostBridge {
  readonly rpcWebSocketUrl: () => Promise<string>;
  readonly connectionsState: () => Promise<ShowtimeConnectionsState>;
  readonly createInvitation: (
    name: string,
    scopes: ReadonlyArray<ShowtimeConnectionScope>,
  ) => Promise<ShowtimeConnectionsState>;
  readonly pairingInfo: (invitationId: string) => Promise<ShowtimeConnectionInfo>;
  readonly removeConnection: (id: string) => Promise<ShowtimeConnectionsState>;
  readonly setConnectionsEnabled: (enabled: boolean) => Promise<ShowtimeConnectionsState>;
}
