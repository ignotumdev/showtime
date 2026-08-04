import { Effect } from "effect";
import { describe, expect, it, vi } from "vite-plus/test";
import { liveLeaseLifetimeMs, type LiveSessionId, type ShowId } from "@showtime/contracts";
import { layer, LiveGuard } from "./LiveGuard.js";

const session = "live-session" as LiveSessionId;
const show = "show_0000000000000000" as ShowId;
const run = <A>(effect: Effect.Effect<A, never, LiveGuard>) =>
  Effect.runPromise(effect.pipe(Effect.provide(layer)));

describe("LiveGuard", () => {
  it("blocks maintenance while a live lease exists", async () => {
    await expect(
      run(
        Effect.gen(function* () {
          const guard = yield* LiveGuard;
          expect(yield* guard.heartbeat(session, show)).toBe(true);
          expect(yield* guard.hasActiveSessions).toBe(true);
          return yield* guard.beginMaintenance;
        }),
      ),
    ).resolves.toBe(false);
  });

  it("admits maintenance after release and rejects new live sessions until it ends", async () => {
    await run(
      Effect.gen(function* () {
        const guard = yield* LiveGuard;
        yield* guard.heartbeat(session, show);
        yield* guard.release(session);
        expect(yield* guard.beginMaintenance).toBe(true);
        expect(yield* guard.heartbeat(session, show)).toBe(false);
        yield* guard.endMaintenance;
        expect(yield* guard.heartbeat(session, show)).toBe(true);
      }),
    );
  });

  it("keeps a lease active through its exact expiry boundary", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    try {
      await run(
        Effect.gen(function* () {
          const guard = yield* LiveGuard;
          yield* guard.heartbeat(session, show);

          yield* Effect.sync(() => vi.setSystemTime(liveLeaseLifetimeMs));
          expect(yield* guard.hasActiveSessions).toBe(true);

          yield* Effect.sync(() => vi.setSystemTime(liveLeaseLifetimeMs + 1));
          expect(yield* guard.hasActiveSessions).toBe(false);
        }),
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
