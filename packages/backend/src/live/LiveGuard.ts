import { Clock, Context, Effect, Layer, Ref } from "effect";
import type { LiveSessionId, ShowId } from "@showtime/contracts";

export const liveLeaseLifetimeMs = 15_000;

interface LiveLease {
  readonly showId: ShowId;
  readonly expiresAt: number;
}

interface LiveGuardState {
  readonly maintenance: boolean;
  readonly leases: ReadonlyMap<LiveSessionId, LiveLease>;
}

const activeLeases = (state: LiveGuardState, now: number) =>
  new Map([...state.leases].filter(([, lease]) => lease.expiresAt > now));

export class LiveGuard extends Context.Service<
  LiveGuard,
  {
    readonly heartbeat: (sessionId: LiveSessionId, showId: ShowId) => Effect.Effect<boolean>;
    readonly release: (sessionId: LiveSessionId) => Effect.Effect<void>;
    readonly hasActiveSessions: Effect.Effect<boolean>;
    readonly beginMaintenance: Effect.Effect<boolean>;
    readonly endMaintenance: Effect.Effect<void>;
  }
>()("@showtime/backend/live/LiveGuard") {}

const make = Effect.gen(function* () {
  const state = yield* Ref.make<LiveGuardState>({ maintenance: false, leases: new Map() });

  const heartbeat = (sessionId: LiveSessionId, showId: ShowId) =>
    Clock.currentTimeMillis.pipe(
      Effect.flatMap((now) =>
        Ref.modify(state, (current) => {
          const leases = activeLeases(current, now);
          if (current.maintenance) return [false, { ...current, leases }] as const;
          leases.set(sessionId, { showId, expiresAt: now + liveLeaseLifetimeMs });
          return [true, { maintenance: false, leases }] as const;
        }),
      ),
    );

  const release = (sessionId: LiveSessionId) =>
    Ref.update(state, (current) => {
      const leases = new Map(current.leases);
      leases.delete(sessionId);
      return { ...current, leases };
    });

  const hasActiveSessions = Clock.currentTimeMillis.pipe(
    Effect.flatMap((now) =>
      Ref.modify(state, (current) => {
        const leases = activeLeases(current, now);
        return [leases.size > 0, { ...current, leases }] as const;
      }),
    ),
  );

  const beginMaintenance = Clock.currentTimeMillis.pipe(
    Effect.flatMap((now) =>
      Ref.modify(state, (current) => {
        const leases = activeLeases(current, now);
        if (current.maintenance || leases.size > 0) {
          return [false, { ...current, leases }] as const;
        }
        return [true, { maintenance: true, leases }] as const;
      }),
    ),
  );

  return LiveGuard.of({
    heartbeat,
    release,
    hasActiveSessions,
    beginMaintenance,
    endMaintenance: Ref.update(state, (current) => ({ ...current, maintenance: false })),
  });
});

export const layer = Layer.effect(LiveGuard, make);
