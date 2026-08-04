import { Schema } from "effect";
import { describe, expect, expectTypeOf, it } from "vite-plus/test";
import { LiveSessionId } from "./live.js";
import type { ShowId } from "./show.js";

const decode = Schema.decodeUnknownSync(LiveSessionId);

describe("LiveSessionId", () => {
  it("accepts non-empty session ids up to 128 characters", () => {
    expect(decode("live-session")).toBe("live-session");
    expect(decode("a".repeat(128))).toBe("a".repeat(128));
  });

  it("rejects empty or overly long session ids", () => {
    expect(() => decode("")).toThrow();
    expect(() => decode("a".repeat(129))).toThrow();
  });

  it("is nominally distinct from an arbitrary string", () => {
    expectTypeOf<string>().not.toMatchTypeOf<typeof LiveSessionId.Type>();
    expectTypeOf<ShowId>().not.toMatchTypeOf<typeof LiveSessionId.Type>();
    expectTypeOf<typeof LiveSessionId.Type>().toMatchTypeOf<string>();
  });
});
