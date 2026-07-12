export const desktopRpcWebSocketUrlChannel = "showtime:rpc-web-socket-url";

/** Capabilities supplied by a native host. Browser clients run without this bridge. */
export interface ShowtimeHostBridge {
  readonly rpcWebSocketUrl: () => Promise<string>;
}
