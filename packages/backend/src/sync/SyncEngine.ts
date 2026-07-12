import { Context, Effect, Layer, PartitionedSemaphore, Stream } from "effect";
import { Reactivity } from "effect/unstable/reactivity";

type SyncKeys = ReadonlyArray<unknown>;

interface SyncEngineShape {
  readonly query: <A, E, R>(
    keys: SyncKeys,
    effect: Effect.Effect<A, E, R>,
  ) => Stream.Stream<A, E, R>;
  readonly mutation: <A, E, R>(
    keys: SyncKeys,
    effect: Effect.Effect<A, E, R>,
  ) => Effect.Effect<A, E, R>;
}

export class SyncEngine extends Context.Service<SyncEngine, SyncEngineShape>()(
  "@showtime/backend/sync/SyncEngine",
) {}

const make = Effect.gen(function* () {
  const reactivity = yield* Reactivity.Reactivity;
  const transaction = yield* PartitionedSemaphore.make<string>({ permits: 1 });
  const transact = transaction.withPermit("sync");

  const query: SyncEngineShape["query"] = (keys, effect) =>
    reactivity.stream(keys, transact(effect));

  const mutation: SyncEngineShape["mutation"] = (keys, effect) => {
    return transact(reactivity.mutation(keys, effect));
  };

  return SyncEngine.of({ query, mutation });
});

export const layer = Layer.effect(SyncEngine, make).pipe(Layer.provide(Reactivity.layer));
