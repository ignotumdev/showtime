import { Deferred, Effect, Ref, Stream } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { SyncEngine, layer } from "./SyncEngine.js";

describe("SyncEngine", () => {
  it("emits an initial snapshot and republishes the full value after a mutation", async () => {
    const snapshots = await Effect.runPromise(
      Effect.gen(function* () {
        const sync = yield* SyncEngine;
        const value = yield* Ref.make<ReadonlyArray<number>>([]);
        const firstRead = yield* Deferred.make<void>();
        const subscription = sync
          .query(
            ["items"],
            Ref.get(value).pipe(Effect.tap(() => Deferred.succeed(firstRead, void 0))),
          )
          .pipe(Stream.take(2), Stream.runCollect);
        const mutate = Deferred.await(firstRead).pipe(
          Effect.andThen(sync.mutation(["items"], Ref.set(value, [1, 2, 3]))),
        );
        const [values] = yield* Effect.all([subscription, mutate], { concurrency: "unbounded" });
        return Array.from(values);
      }).pipe(Effect.scoped, Effect.provide(layer)),
    );

    expect(snapshots).toEqual([[], [1, 2, 3]]);
  });

  it("does not republish after a failed mutation", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const sync = yield* SyncEngine;
        const reads = yield* Ref.make(0);
        const firstRead = yield* Deferred.make<void>();
        const subscription = sync
          .query(
            ["items"],
            Ref.updateAndGet(reads, (count) => count + 1).pipe(
              Effect.tap(() => Deferred.succeed(firstRead, void 0)),
            ),
          )
          .pipe(Stream.runDrain);
        const mutate = Deferred.await(firstRead).pipe(
          Effect.andThen(sync.mutation(["items"], Effect.fail("nope")).pipe(Effect.flip)),
          Effect.andThen(Effect.sleep("10 millis")),
        );
        yield* Effect.raceFirst(subscription, mutate);
        return yield* Ref.get(reads);
      }).pipe(Effect.scoped, Effect.provide(layer)),
    );

    expect(result).toBe(1);
  });
});
