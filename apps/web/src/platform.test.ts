import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { browserRpcWebSocketUrl, resolveRpcWebSocketUrl } from "./platform";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

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

describe("resolveRpcWebSocketUrl", () => {
  it("prefers the desktop host bridge", async () => {
    vi.stubEnv("VITE_SHOWTIME_RPC_WEBSOCKET_URL", "ws://configured.example/rpc");
    vi.stubGlobal("window", {
      location: { protocol: "https:", host: "browser.example" },
      showtime: { rpcWebSocketUrl: vi.fn().mockResolvedValue("ws://desktop.example/rpc") },
    });

    await expect(resolveRpcWebSocketUrl()).resolves.toBe("ws://desktop.example/rpc");
  });

  it("uses the configured URL without a desktop bridge", async () => {
    vi.stubEnv("VITE_SHOWTIME_RPC_WEBSOCKET_URL", "wss://configured.example/rpc");
    vi.stubGlobal("window", {
      location: { protocol: "https:", host: "browser.example" },
    });

    await expect(resolveRpcWebSocketUrl()).resolves.toBe("wss://configured.example/rpc");
  });

  it("uses the browser origin when no host or configured URL is available", async () => {
    vi.stubEnv("VITE_SHOWTIME_RPC_WEBSOCKET_URL", "");
    vi.stubGlobal("window", {
      location: { protocol: "https:", host: "showtime.local:8443" },
    });

    await expect(resolveRpcWebSocketUrl()).resolves.toBe("wss://showtime.local:8443/rpc");
  });

  it("falls back to configuration when the desktop bridge returns an empty URL", async () => {
    vi.stubEnv("VITE_SHOWTIME_RPC_WEBSOCKET_URL", "ws://configured.example/rpc");
    vi.stubGlobal("window", {
      location: { protocol: "file:", host: "" },
      showtime: { rpcWebSocketUrl: vi.fn().mockResolvedValue("") },
    });

    await expect(resolveRpcWebSocketUrl()).resolves.toBe("ws://configured.example/rpc");
  });
});
