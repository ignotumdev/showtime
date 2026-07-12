import { readStoredConnection, storedRpcWebSocketUrl } from "./connection";

export const browserRpcWebSocketUrl = (location: Pick<Location, "protocol" | "host">) => {
  const connection = readStoredConnection();
  if (connection) return storedRpcWebSocketUrl(location, connection);
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${location.host}/rpc/unpaired`;
};

export const resolveRpcWebSocketUrl = async () => {
  const bridge = window.showtime;
  if (bridge) {
    const bridgeUrl = await bridge.rpcWebSocketUrl();
    if (bridgeUrl) return bridgeUrl;
  }
  const configuredUrl = import.meta.env.VITE_SHOWTIME_RPC_WEBSOCKET_URL;
  if (configuredUrl) return configuredUrl;
  return browserRpcWebSocketUrl(window.location);
};

export const isDesktopHost = () => window.showtime !== undefined;
