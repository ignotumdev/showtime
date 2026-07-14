import { describe, expect, it } from "vite-plus/test";
import { Schema } from "effect";
import {
  ShowtimeConnectionInfo,
  ShowtimeHostnameLabel,
  desktopRpcWebSocketUrlChannel,
  formatShowtimeHostnameLabel,
  parseShowtimeHostnameSuffix,
  showtimeHostnamePairingUrl,
  showtimeLocalPort,
} from "./index.js";

describe("desktop host bridge", () => {
  it("uses a namespaced endpoint discovery channel", () => {
    expect(desktopRpcWebSocketUrlChannel).toBe("showtime:rpc-web-socket-url");
  });
});

describe("local endpoint", () => {
  it("uses the canonical port and exact suffix sequence", () => {
    expect(showtimeLocalPort).toBe(8585);
    expect([0, 1, 2].map(formatShowtimeHostnameLabel)).toEqual([
      "showtime",
      "showtime-1",
      "showtime-2",
    ]);
    expect(parseShowtimeHostnameSuffix("showtime-12")).toBe(12);
    expect(parseShowtimeHostnameSuffix("showtime-(2)")).toBeUndefined();
  });

  it("rejects hostname labels with trailing line terminators", () => {
    for (const label of [
      "showtime\n",
      "showtime\r",
      "showtime\r\n",
      "showtime\u2028",
      "showtime\u2029",
      "showtime-1\n",
    ]) {
      expect(() => Schema.decodeUnknownSync(ShowtimeHostnameLabel)(label)).toThrow();
      expect(parseShowtimeHostnameSuffix(label)).toBeUndefined();
    }
  });

  it("encodes pairing fragments and validates the IPC DTO", () => {
    expect(showtimeHostnamePairingUrl("showtime", "token with spaces")).toBe(
      "http://showtime.local:8585/#pair=token%20with%20spaces",
    );
    expect(() =>
      Schema.decodeUnknownSync(ShowtimeConnectionInfo)({ discovery: { kind: "probing" } }),
    ).toThrow();
  });
});
