import { Context, Effect, Layer, Schema } from "effect";
import { customAlphabet } from "nanoid";
import {
  idAlphabet,
  idSuffixLength,
  MicrophoneId,
  microphoneIdPrefix,
  ShowId,
  showIdPrefix,
  MixId,
  mixIdPrefix,
  SongId,
  songIdPrefix,
} from "@showtime/contracts";

export class Ids extends Context.Service<
  Ids,
  {
    readonly makeShowId: Effect.Effect<ShowId>;
    readonly makeMicrophoneId: Effect.Effect<MicrophoneId>;
    readonly makeMixId: Effect.Effect<MixId>;
    readonly makeSongId: Effect.Effect<SongId>;
  }
>()("showtime/Ids") {}

const makeId = customAlphabet(idAlphabet, idSuffixLength);

export const layer = Layer.succeed(
  Ids,
  Ids.of({
    makeShowId: Effect.sync(() => `${showIdPrefix}${makeId()}`).pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(ShowId)),
      Effect.orDie,
    ),
    makeMicrophoneId: Effect.sync(() => `${microphoneIdPrefix}${makeId()}`).pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(MicrophoneId)),
      Effect.orDie,
    ),
    makeMixId: Effect.sync(() => `${mixIdPrefix}${makeId()}`).pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(MixId)),
      Effect.orDie,
    ),
    makeSongId: Effect.sync(() => `${songIdPrefix}${makeId()}`).pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(SongId)),
      Effect.orDie,
    ),
  }),
);
