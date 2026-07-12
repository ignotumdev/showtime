import { describe, expect, it } from "vite-plus/test";
import { browserRpcWebSocketUrl } from "./platform";

describe("browserRpcWebSocketUrl", () => {
  it("uses a same-origin websocket endpoint", () => {
    expect(browserRpcWebSocketUrl({ protocol: "http:", host: "showtime.local:8080" })).toBe(
      "ws://showtime.local:8080/rpc",
    );
  });
  it("uses a secure websocket for HTTPS", () => {
    expect(browserRpcWebSocketUrl({ protocol: "https:", host: "showtime.local" })).toBe(
      "wss://showtime.local/rpc",
    );
  });
});
