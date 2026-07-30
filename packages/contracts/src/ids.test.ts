import { describe, expect, it } from "vite-plus/test";
import { Schema } from "effect";
import { idSuffixLength, makeClientId, makeTemporaryId } from "./ids.js";
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

describe("makeTemporaryId", () => {
  it("generates an id with the requested prefix and shared suffix format", () => {
    const id = makeTemporaryId("pending_");

    expect(id).toMatch(new RegExp(`^pending_[0-9a-z]{${idSuffixLength}}$`));
  });
});

describe("makeClientId", () => {
  it("generates stable-format IDs suitable for create request payloads", () => {
    const id = makeClientId("song_");

    expect(id).toMatch(new RegExp(`^song_[0-9a-z]{${idSuffixLength}}$`));
  });
});
