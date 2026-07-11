import { Schema } from "effect";
import { describe, expect, expectTypeOf, it } from "vite-plus/test";
import {
  MicrophoneNumber,
  nextMicrophoneNumber,
  type MicrophoneNumber as MicrophoneNumberType,
} from "./microphone.js";

const decode = Schema.decodeUnknownSync(MicrophoneNumber);

describe("MicrophoneNumber", () => {
  it("accepts non-blank labels", () => {
    expect(decode("1")).toBe("1");
    expect(decode("A1")).toBe("A1");
  });

  it.each(["", "   "])("rejects invalid value %j", (value) => {
    expect(() => decode(value)).toThrow();
  });

  it("is nominally distinct from a plain string", () => {
    expectTypeOf<string>().not.toMatchTypeOf<MicrophoneNumberType>();
    expectTypeOf<MicrophoneNumberType>().toMatchTypeOf<string>();
  });
});

describe("nextMicrophoneNumber", () => {
  it("increments canonical positive-integer labels", () => {
    expect(nextMicrophoneNumber(["1", "3", "2"])).toBe("4");
  });

  it("ignores custom labels that Number would interpret as integers", () => {
    expect(nextMicrophoneNumber(["2e3", "0x10", " 2 ", "02", "+2", "0", "9007199254740992"])).toBe(
      "1",
    );
  });
});
