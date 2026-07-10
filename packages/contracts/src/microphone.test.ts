import { Schema } from "effect";
import { describe, expect, expectTypeOf, it } from "vite-plus/test";
import { MicrophoneNumber, type MicrophoneNumber as MicrophoneNumberType } from "./microphone.js";

const decode = Schema.decodeUnknownSync(MicrophoneNumber);

describe("MicrophoneNumber", () => {
  it("accepts positive safe integers", () => {
    expect(decode(1)).toBe(1);
    expect(decode(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])("rejects invalid value %s", (value) => {
    expect(() => decode(value)).toThrow();
  });

  it("is nominally distinct from a plain number", () => {
    expectTypeOf<number>().not.toMatchTypeOf<MicrophoneNumberType>();
    expectTypeOf<MicrophoneNumberType>().toMatchTypeOf<number>();
  });
});
