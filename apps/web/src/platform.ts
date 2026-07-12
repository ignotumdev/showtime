const defaultRpcPath = "/rpc";

export const browserRpcWebSocketUrl = (location: Pick<Location, "protocol" | "host">) => {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${location.host}${defaultRpcPath}`;
};

export const resolveRpcWebSocketUrl = async () => {
  const bridge = window.showtime;
  if (bridge) return bridge.rpcWebSocketUrl();
  const configuredUrl = import.meta.env.VITE_SHOWTIME_RPC_WEBSOCKET_URL;
  if (configuredUrl) return configuredUrl;
  return browserRpcWebSocketUrl(window.location);
};

export const isDesktopHost = () => window.showtime !== undefined;
