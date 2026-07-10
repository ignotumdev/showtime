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

export const MicrophoneNumber = Schema.Number.pipe(
  Schema.check(
    Schema.makeFilter((value) => Number.isSafeInteger(value) && value >= 1, {
      expected: "a positive whole number",
    }),
  ),
  Schema.brand("MicrophoneNumber"),
);
export type MicrophoneNumber = typeof MicrophoneNumber.Type;

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
