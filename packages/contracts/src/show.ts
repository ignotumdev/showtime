import { Effect, Schema, SchemaGetter } from "effect";

export const showIdPrefix = "show_";
export const idAlphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
export const idSuffixLength = 16;

const showIdPattern = new RegExp(`^${showIdPrefix}[${idAlphabet}]{${idSuffixLength}}$`);

export const ShowId = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(showIdPattern, {
      expected: `${showIdPrefix} followed by ${idSuffixLength} lowercase base36 characters`,
    }),
  ),
  Schema.brand("ShowId"),
);

export type ShowId = typeof ShowId.Type;

export const parseShowId = Schema.decodeUnknownSync(ShowId);

export const ShowConfigVersion = Schema.Literal("dev");
export type ShowConfigVersion = typeof ShowConfigVersion.Type;

export const ShowFileType = Schema.Literal("showtime-show");
export type ShowFileType = typeof ShowFileType.Type;

const NonBlankString = Schema.String.pipe(
  Schema.check(
    Schema.makeFilter((value) => value.trim().length > 0, {
      expected: "a non-empty string after trimming whitespace",
    }),
  ),
);

export const ShowName = NonBlankString.pipe(Schema.brand("ShowName"));
export type ShowName = typeof ShowName.Type;

export const showColors = [
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
  "neutral",
] as const;

export const ShowColor = Schema.Literals(showColors);
export type ShowColor = typeof ShowColor.Type;

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
);
export type MicrophoneNumber = typeof MicrophoneNumber.Type;

export const Microphone = Schema.Struct({
  id: MicrophoneId,
  number: MicrophoneNumber,
  color: ShowColor,
  name: Schema.optional(Schema.String),
});
export type Microphone = typeof Microphone.Type;

const MicrophonesWithLegacyDefault = Schema.optional(Schema.Array(Microphone)).pipe(
  Schema.decodeTo(Schema.toType(Schema.Array(Microphone)), {
    decode: SchemaGetter.withDefault(Effect.succeed([] as ReadonlyArray<Microphone>)),
    encode: SchemaGetter.required(),
  }),
);

const ShowColorWithLegacyDefault = Schema.optional(ShowColor).pipe(
  Schema.decodeTo(Schema.toType(ShowColor), {
    decode: SchemaGetter.withDefault(Effect.succeed("neutral" as ShowColor)),
    encode: SchemaGetter.required(),
  }),
);

export const ShowConfig = Schema.Struct({
  id: ShowId,
  name: ShowName,
  color: ShowColorWithLegacyDefault,
  createdAt: Schema.DateTimeUtcFromString,
  updatedAt: Schema.DateTimeUtcFromString,
});

export type ShowConfig = typeof ShowConfig.Type;
export type ShowConfigEncoded = typeof ShowConfig.Encoded;

export const ShowFileDocument = Schema.Struct({
  type: ShowFileType,
  version: ShowConfigVersion,
  config: ShowConfig,
  microphones: MicrophonesWithLegacyDefault,
});

export type ShowFileDocument = typeof ShowFileDocument.Type;
export type ShowFileDocumentEncoded = typeof ShowFileDocument.Encoded;

export const decodeShowFileDocument = Schema.decodeUnknownEffect(ShowFileDocument);
export const encodeShowFileDocument = Schema.encodeEffect(ShowFileDocument);
export const decodeShowName = Schema.decodeUnknownEffect(ShowName);

export class ShowFileReadError extends Schema.TaggedErrorClass<ShowFileReadError>()(
  "ShowFileReadError",
  {
    path: Schema.String,
    cause: Schema.Defect(),
  },
) {}

export class ShowFileWriteError extends Schema.TaggedErrorClass<ShowFileWriteError>()(
  "ShowFileWriteError",
  {
    path: Schema.String,
    cause: Schema.Defect(),
  },
) {}

export class ShowFileJsonError extends Schema.TaggedErrorClass<ShowFileJsonError>()(
  "ShowFileJsonError",
  {
    path: Schema.String,
    cause: Schema.Defect(),
  },
) {}

export class ShowFileSchemaError extends Schema.TaggedErrorClass<ShowFileSchemaError>()(
  "ShowFileSchemaError",
  {
    path: Schema.String,
    cause: Schema.Defect(),
  },
) {}

export class ShowFileUpdateError extends Schema.TaggedErrorClass<ShowFileUpdateError>()(
  "ShowFileUpdateError",
  {
    path: Schema.String,
    cause: Schema.Defect(),
  },
) {}

export type ShowFileError =
  | ShowFileReadError
  | ShowFileWriteError
  | ShowFileJsonError
  | ShowFileSchemaError
  | ShowFileUpdateError;

export class ShowDiscoveryDirectoryError extends Schema.TaggedErrorClass<ShowDiscoveryDirectoryError>()(
  "ShowDiscoveryDirectoryError",
  {
    path: Schema.String,
    cause: Schema.Defect(),
  },
) {}

export class ShowDiscoveryStatError extends Schema.TaggedErrorClass<ShowDiscoveryStatError>()(
  "ShowDiscoveryStatError",
  {
    path: Schema.String,
    cause: Schema.Defect(),
  },
) {}

export type ShowDiscoveryError = ShowDiscoveryDirectoryError | ShowDiscoveryStatError;

export const ShowSummary = Schema.Struct({
  id: ShowId,
  name: ShowName,
  color: ShowColor,
  createdAt: Schema.String,
  updatedAt: Schema.String,
});

export type ShowSummary = typeof ShowSummary.Type;

export const compareShowSummaries = (left: ShowSummary, right: ShowSummary) =>
  `${left.name.toLocaleLowerCase()}:${left.id}`.localeCompare(
    `${right.name.toLocaleLowerCase()}:${right.id}`,
  );

export const sortShowSummaries = (shows: ReadonlyArray<ShowSummary>) =>
  [...shows].sort(compareShowSummaries);
