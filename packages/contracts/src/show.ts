import { Schema } from "effect";
import { Color } from "./color.js";
import { idAlphabet, idSuffixLength } from "./ids.js";

export { Color, colors } from "./color.js";
export const showIdPrefix = "show_";
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

const NonBlankString = Schema.String.pipe(
  Schema.check(
    Schema.makeFilter((value) => value.trim().length > 0, {
      expected: "a non-empty string after trimming whitespace",
    }),
  ),
);

export const ShowName = NonBlankString.pipe(Schema.brand("ShowName"));
export type ShowName = typeof ShowName.Type;

export const ShowConfig = Schema.Struct({
  id: ShowId,
  name: ShowName,
  color: Color,
  createdAt: Schema.DateTimeUtcFromString,
  updatedAt: Schema.DateTimeUtcFromString,
});

export type ShowConfig = typeof ShowConfig.Type;
export type ShowConfigEncoded = typeof ShowConfig.Encoded;

export const decodeShowName = Schema.decodeUnknownEffect(ShowName);

export const ShowSummary = Schema.Struct({
  id: ShowId,
  name: ShowName,
  color: Color,
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
