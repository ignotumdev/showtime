import { describe, expect, it } from "vite-plus/test";
import { Schema } from "effect";
import {
  ShowtimeConnectionInfo,
  ShowtimeHostName,
  ShowtimeHostnameLabel,
  desktopRpcWebSocketUrlChannel,
  normalizeShowtimeHostName,
  showtimeHostnamePairingUrl,
  showtimeHostnameLabel,
  showtimeLocalPort,
} from "./index.js";

describe("desktop host bridge", () => {
  it("uses a namespaced endpoint discovery channel", () => {
    expect(desktopRpcWebSocketUrlChannel).toBe("showtime:rpc-web-socket-url");
  });
});

describe("local endpoint", () => {
  it("builds a stable device-specific local hostname", () => {
    expect(showtimeLocalPort).toBe(8585);
    expect(normalizeShowtimeHostName("FOH Laptop.local")).toBe("foh-laptop-local");
    expect(showtimeHostnameLabel("foh-laptop")).toBe("showtime-foh-laptop");
  });

  it("keeps non-Latin device names stable and distinct", () => {
    const stage = normalizeShowtimeHostName("舞台");
    const sound = normalizeShowtimeHostName("音響");

    expect(stage).toMatch(/^device-[a-z0-9]+$/);
    expect(normalizeShowtimeHostName("舞台")).toBe(stage);
    expect(sound).not.toBe(stage);
  });

  it("rejects hostname labels with trailing line terminators", () => {
    for (const label of [
      "showtime-foh\n",
      "showtime-foh\r",
      "showtime-foh\r\n",
      "showtime-foh\u2028",
      "showtime-foh\u2029",
    ]) {
      expect(() => Schema.decodeUnknownSync(ShowtimeHostnameLabel)(label)).toThrow();
    }
    expect(() => Schema.decodeUnknownSync(ShowtimeHostName)("FOH laptop")).toThrow();
    expect(() => Schema.decodeUnknownSync(ShowtimeHostnameLabel)("showtime")).toThrow();
  });

  it("encodes pairing fragments and validates the IPC DTO", () => {
    expect(showtimeHostnamePairingUrl("showtime-foh", "token with spaces")).toBe(
      "http://showtime-foh.local:8585/#pair=token%20with%20spaces",
    );
    expect(() =>
      Schema.decodeUnknownSync(ShowtimeConnectionInfo)({ discovery: { kind: "probing" } }),
    ).toThrow();
    expect(
      Schema.decodeUnknownSync(ShowtimeConnectionInfo)({
        discovery: { kind: "disabled" },
        candidates: [],
        expiresAt: null,
      }),
    ).toEqual({ discovery: { kind: "disabled" }, candidates: [], expiresAt: null });
  });
});
