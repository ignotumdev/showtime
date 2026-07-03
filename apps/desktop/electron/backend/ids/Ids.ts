import { Context, Effect, Layer, Schema } from "effect";
import { customAlphabet } from "nanoid";
import { idAlphabet, idSuffixLength, ShowId, showIdPrefix } from "@showtime/contracts";

export class Ids extends Context.Service<
  Ids,
  {
    readonly makeShowId: Effect.Effect<ShowId>;
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
  }),
);
