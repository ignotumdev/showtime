import { Schema } from "effect";
import { Color } from "./color.js";
import { idAlphabet, idSuffixLength } from "./ids.js";

export const microphoneIdPrefix = "mic_";
const microphoneIdPattern = new RegExp(`^${microphoneIdPrefix}[${idAlphabet}]{${idSuffixLength}}$`);

export const MicrophoneId = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(microphoneIdPattern, {
      expected: `${microphoneIdPrefix} followed by ${idSuffixLength} lowercase base36 characters`,
    }),
  ),
  Schema.brand("MicrophoneId"),
);
export type MicrophoneId = typeof MicrophoneId.Type;

export const MicrophoneNumber = Schema.String.pipe(
  Schema.check(
    Schema.makeFilter((value) => value.trim().length > 0, {
      expected: "a non-empty microphone label",
    }),
  ),
  Schema.brand("MicrophoneNumber"),
);
export type MicrophoneNumber = typeof MicrophoneNumber.Type;

const canonicalPositiveIntegerPattern = /^[1-9]\d*$/;

export const nextMicrophoneNumber = (numbers: Iterable<string>): MicrophoneNumber => {
  let maximum = 0;
  for (const number of numbers) {
    if (!canonicalPositiveIntegerPattern.test(number)) continue;
    const value = Number(number);
    if (Number.isSafeInteger(value)) maximum = Math.max(maximum, value);
  }
  return MicrophoneNumber.make(String(maximum + 1));
};

export const Microphone = Schema.Struct({
  id: MicrophoneId,
  number: MicrophoneNumber,
  color: Color,
  name: Schema.optional(Schema.String),
  createdAt: Schema.DateTimeUtcFromString,
  updatedAt: Schema.DateTimeUtcFromString,
  deletedAt: Schema.optional(Schema.DateTimeUtcFromString),
});
export type Microphone = typeof Microphone.Type;
