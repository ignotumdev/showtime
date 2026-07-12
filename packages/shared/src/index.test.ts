import { describe, expect, it } from "vite-plus/test";
import { desktopRpcWebSocketUrlChannel } from "./index.js";

describe("desktop host bridge", () => {
  it("uses a namespaced endpoint discovery channel", () => {
    expect(desktopRpcWebSocketUrlChannel).toBe("showtime:rpc-web-socket-url");
  });
});
