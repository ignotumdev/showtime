import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";
import type { LiveSessionId, ShowId } from "@showtime/contracts";
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
});
