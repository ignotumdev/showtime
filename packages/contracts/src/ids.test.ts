import { describe, expect, it } from "vite-plus/test";
import { Schema } from "effect";
import { ShowId } from "./show.js";

const decode = Schema.decodeUnknownSync(ShowId);

describe("ShowId", () => {
  it("accepts the expected show id format", () => {
    expect(decode("show_0123456789abcdef")).toBe("show_0123456789abcdef");
  });

  it("rejects invalid prefixes", () => {
    expect(() => decode("song_0123456789abcdef")).toThrow();
  });

  it("rejects invalid suffix lengths", () => {
    expect(() => decode("show_0123456789abcde")).toThrow();
    expect(() => decode("show_0123456789abcdef0")).toThrow();
  });

  it("rejects characters outside the lowercase base36 alphabet", () => {
    expect(() => decode("show_0123456789abcdeF")).toThrow();
    expect(() => decode("show_0123456789abcde_")).toThrow();
  });
});
