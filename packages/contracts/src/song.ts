import { Schema } from "effect";
import { idAlphabet, idSuffixLength } from "./ids.js";
import { MicrophoneId } from "./microphone.js";
import { MixId } from "./mix.js";

export const songIdPrefix = "song_";
const songIdPattern = new RegExp(`^${songIdPrefix}[${idAlphabet}]{${idSuffixLength}}$`);

export const SongId = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(songIdPattern, {
      expected: `${songIdPrefix} followed by ${idSuffixLength} lowercase base36 characters`,
    }),
  ),
  Schema.brand("SongId"),
);
export type SongId = typeof SongId.Type;

export const SongName = Schema.String.pipe(Schema.brand("SongName"));
export type SongName = typeof SongName.Type;
export const SongArtist = Schema.String.pipe(Schema.brand("SongArtist"));
export type SongArtist = typeof SongArtist.Type;

const UniqueMicrophoneIds = Schema.Array(MicrophoneId).pipe(
  Schema.check(
    Schema.makeFilter((ids) => new Set(ids).size === ids.length, {
      expected: "unique microphone IDs",
    }),
  ),
);

export const SongMixAssignment = Schema.Struct({
  mixId: MixId,
  microphoneIds: UniqueMicrophoneIds,
});
export type SongMixAssignment = typeof SongMixAssignment.Type;

const UniqueMixAssignments = Schema.Array(SongMixAssignment).pipe(
  Schema.check(
    Schema.makeFilter(
      (assignments) =>
        new Set(assignments.map((assignment) => assignment.mixId)).size === assignments.length,
      { expected: "at most one assignment for each mix" },
    ),
  ),
);

export const Song = Schema.Struct({
  id: SongId,
  name: SongName,
  artist: SongArtist,
  notes: Schema.optional(Schema.String),
  mixAssignments: UniqueMixAssignments,
  createdAt: Schema.DateTimeUtcFromString,
  updatedAt: Schema.DateTimeUtcFromString,
  deletedAt: Schema.optional(Schema.DateTimeUtcFromString),
});
export type Song = typeof Song.Type;

export const decodeSongName = Schema.decodeUnknownEffect(SongName);
export const decodeSongArtist = Schema.decodeUnknownEffect(SongArtist);
