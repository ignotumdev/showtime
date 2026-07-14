import { Clock, Context, Deferred, Effect, Layer, Path, Ref, Schema, Semaphore } from "effect";
import { FileSystem } from "effect/FileSystem";
import { nanoid } from "nanoid";
import { randomBytes } from "node:crypto";
import { ShowtimeConnectionScopes, type ShowtimeConnectionScope } from "@showtime/shared";
import * as HomeDirectory from "../platform/HomeDirectory.js";
import { isNotFound, readJson, writeJsonAtomic } from "../persistence/JsonFile.js";

const NanoId = Schema.String.check(Schema.isPattern(/^[A-Za-z0-9_-]{21}$/));
const Capability = Schema.String.check(Schema.isPattern(/^[A-Za-z0-9_-]{43}$/));
const ClientName = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(80));
const Client = Schema.Struct({
  clientId: NanoId,
  name: ClientName,
  capability: Capability,
  createdAt: Schema.String,
  scopes: ShowtimeConnectionScopes,
});
const Invitation = Schema.Struct({
  invitationId: NanoId,
  name: ClientName,
  token: Capability,
  expiresAt: Schema.String,
  scopes: ShowtimeConnectionScopes,
});
const ConnectionsFile = Schema.Struct({
  version: Schema.Literal(1),
  clients: Schema.Array(Client),
  invitations: Schema.Array(Invitation),
});

export type StoredClient = typeof Client.Type;
export type StoredInvitation = typeof Invitation.Type;
export interface PairingCredentials {
  readonly clientId: string;
  readonly capability: string;
  readonly scopes: ReadonlyArray<ShowtimeConnectionScope>;
}

const pairingLifetimeMs = 5 * 60 * 1_000;
const makeToken = () => randomBytes(32).toString("base64url");
const makeInvitation = (
  name: string,
  scopes: ReadonlyArray<ShowtimeConnectionScope>,
  now: number,
): StoredInvitation => ({
  invitationId: nanoid(),
  name,
  token: makeToken(),
  expiresAt: new Date(now + pairingLifetimeMs).toISOString(),
  scopes: [...scopes],
});

export class ConnectionStore extends Context.Service<
  ConnectionStore,
  {
    readonly clients: Effect.Effect<ReadonlyArray<StoredClient>>;
    readonly invitations: Effect.Effect<ReadonlyArray<StoredInvitation>>;
    readonly connectedClientIds: Effect.Effect<ReadonlySet<string>>;
    readonly createInvitation: (
      name: string,
      scopes: ReadonlyArray<ShowtimeConnectionScope>,
    ) => Effect.Effect<StoredInvitation>;
    readonly pairingInvitation: (
      invitationId: string,
    ) => Effect.Effect<StoredInvitation | undefined>;
    readonly consumeInvitation: (token: string) => Effect.Effect<PairingCredentials | undefined>;
    readonly remove: (id: string) => Effect.Effect<void>;
    readonly disconnectAll: Effect.Effect<void>;
    readonly credentialsStatus: (
      clientId: string,
      capability: string,
    ) => Effect.Effect<"authorized" | "revoked">;
    readonly scopeAuthorization: (
      clientId: string,
      capability: string,
      scope: ShowtimeConnectionScope,
    ) => Effect.Effect<"authorized" | "forbidden" | "revoked">;
    readonly withAuthorizedSession: <A, E, R, E2, R2>(
      clientId: string,
      capability: string,
      isEnabled: Effect.Effect<boolean, E2, R2>,
      effect: Effect.Effect<A, E, R>,
    ) => Effect.Effect<A | undefined, E | E2, R | R2>;
  }
>()("@showtime/backend/connections/ConnectionStore") {}

const make = Effect.gen(function* () {
  const fs = yield* FileSystem;
  const path = yield* Path.Path;
  const home = yield* HomeDirectory.HomeDirectory;
  const directory = path.join(yield* home.homeDirectory, ".showtime");
  const filePath = path.join(directory, "connections.json");
  const initial = yield* readJson(fs, filePath, ConnectionsFile).pipe(
    Effect.catchIf(isNotFound, () =>
      Effect.succeed({ version: 1 as const, clients: [], invitations: [] }),
    ),
    Effect.orDie,
  );
  const state = yield* Ref.make(initial);
  const sessions = yield* Ref.make(new Map<string, ReadonlySet<Deferred.Deferred<void>>>());
  const lock = yield* Semaphore.make(1);
  const persist = (next: typeof ConnectionsFile.Type) =>
    writeJsonAtomic(fs, directory, filePath, next).pipe(
      Effect.orDie,
      Effect.andThen(Ref.set(state, next)),
    );

  const createInvitation = (
    name: string,
    requestedScopes: ReadonlyArray<ShowtimeConnectionScope>,
  ) =>
    lock.withPermits(1)(
      Effect.gen(function* () {
        const validatedName = yield* Schema.decodeUnknownEffect(ClientName)(name.trim()).pipe(
          Effect.orDie,
        );
        const scopes = yield* Schema.decodeUnknownEffect(ShowtimeConnectionScopes)(
          requestedScopes,
        ).pipe(Effect.orDie);
        const now = yield* Clock.currentTimeMillis;
        const invitation = makeInvitation(validatedName, scopes, now);
        const current = yield* Ref.get(state);
        yield* persist({
          ...current,
          invitations: [...current.invitations, invitation],
        });
        yield* Effect.logInfo("Created client pairing invitation").pipe(
          Effect.annotateLogs({
            invitationId: invitation.invitationId,
            clientName: invitation.name,
          }),
        );
        return invitation;
      }),
    );

  const pairingInvitation = (invitationId: string) =>
    lock.withPermits(1)(
      Effect.gen(function* () {
        const current = yield* Ref.get(state);
        const invitation = current.invitations.find((item) => item.invitationId === invitationId);
        if (!invitation) return undefined;
        const now = yield* Clock.currentTimeMillis;
        if (Date.parse(invitation.expiresAt) > now) return invitation;
        const renewed = {
          ...invitation,
          token: makeToken(),
          expiresAt: new Date(now + pairingLifetimeMs).toISOString(),
        };
        yield* persist({
          ...current,
          invitations: current.invitations.map((item) =>
            item.invitationId === invitationId ? renewed : item,
          ),
        });
        yield* Effect.logInfo("Renewed expired client pairing invitation").pipe(
          Effect.annotateLogs({ invitationId, clientName: renewed.name }),
        );
        return renewed;
      }),
    );

  const consumeInvitation = (token: string) =>
    lock.withPermits(1)(
      Effect.gen(function* () {
        const current = yield* Ref.get(state);
        const invitation = current.invitations.find((item) => item.token === token);
        const now = yield* Clock.currentTimeMillis;
        if (!invitation || Date.parse(invitation.expiresAt) <= now) {
          yield* Effect.logWarning("Rejected invalid or expired pairing token");
          return undefined;
        }
        const client: StoredClient = {
          clientId: nanoid(),
          name: invitation.name,
          capability: makeToken(),
          createdAt: new Date(now).toISOString(),
          scopes: invitation.scopes,
        };
        yield* persist({
          version: 1,
          clients: [...current.clients, client],
          invitations: current.invitations.filter(
            (item) => item.invitationId !== invitation.invitationId,
          ),
        });
        yield* Effect.logInfo("Paired client").pipe(
          Effect.annotateLogs({ clientId: client.clientId, clientName: client.name }),
        );
        return {
          clientId: client.clientId,
          capability: client.capability,
          scopes: client.scopes,
        };
      }),
    );

  const disconnect = (signals: Iterable<Deferred.Deferred<void>>) =>
    Effect.forEach(signals, (signal) => Deferred.succeed(signal, undefined), {
      discard: true,
    });

  const remove = (id: string) =>
    lock.withPermits(1)(
      Effect.gen(function* () {
        const current = yield* Ref.get(state);
        const client = current.clients.find((item) => item.clientId === id);
        const invitation = current.invitations.find((item) => item.invitationId === id);
        yield* persist({
          version: 1,
          clients: current.clients.filter((item) => item.clientId !== id),
          invitations: current.invitations.filter((item) => item.invitationId !== id),
        });
        const active = (yield* Ref.get(sessions)).get(id) ?? [];
        yield* disconnect(active);
        yield* Effect.logInfo(client ? "Revoked client" : "Removed client invitation").pipe(
          Effect.annotateLogs({
            connectionId: id,
            clientName: client?.name ?? invitation?.name ?? "unknown",
          }),
        );
      }),
    );

  const withAuthorizedSession = <A, E, R, E2, R2>(
    clientId: string,
    capability: string,
    isEnabled: Effect.Effect<boolean, E2, R2>,
    effect: Effect.Effect<A, E, R>,
  ) =>
    Effect.gen(function* () {
      const signal = yield* Deferred.make<void>();
      const admitted = yield* lock.withPermits(1)(
        Effect.gen(function* () {
          if (!(yield* isEnabled)) return false;
          const current = yield* Ref.get(state);
          if (
            !current.clients.some(
              (client) => client.clientId === clientId && client.capability === capability,
            )
          ) {
            return false;
          }
          yield* Ref.update(sessions, (currentSessions) => {
            const next = new Map(currentSessions);
            next.set(clientId, new Set([...(currentSessions.get(clientId) ?? []), signal]));
            return next;
          });
          return true;
        }),
      );
      if (!admitted) return undefined;
      yield* Effect.logInfo("Client connected").pipe(Effect.annotateLogs({ clientId }));
      return yield* Effect.raceFirst(
        effect,
        Deferred.await(signal).pipe(Effect.andThen(Effect.interrupt)),
      ).pipe(
        Effect.ensuring(
          Ref.update(sessions, (current) => {
            const next = new Map(current);
            const remaining = new Set(current.get(clientId) ?? []);
            remaining.delete(signal);
            if (remaining.size === 0) next.delete(clientId);
            else next.set(clientId, remaining);
            return next;
          }).pipe(
            Effect.andThen(
              Effect.logInfo("Client disconnected").pipe(Effect.annotateLogs({ clientId })),
            ),
          ),
        ),
      );
    });

  return ConnectionStore.of({
    clients: Ref.get(state).pipe(Effect.map((file) => file.clients)),
    invitations: Ref.get(state).pipe(Effect.map((file) => file.invitations)),
    connectedClientIds: Ref.get(sessions).pipe(Effect.map((current) => new Set(current.keys()))),
    createInvitation,
    pairingInvitation,
    consumeInvitation,
    remove,
    disconnectAll: lock
      .withPermits(1)(
        Ref.get(sessions).pipe(
          Effect.flatMap((current) =>
            disconnect(Array.from(current.values()).flatMap((signals) => Array.from(signals))),
          ),
        ),
      )
      .pipe(Effect.andThen(Effect.logInfo("Disconnected all remote clients"))),
    credentialsStatus: (clientId, capability) =>
      lock.withPermits(1)(
        Ref.get(state).pipe(
          Effect.map((current) =>
            current.clients.some(
              (client) => client.clientId === clientId && client.capability === capability,
            )
              ? "authorized"
              : "revoked",
          ),
        ),
      ),
    scopeAuthorization: (clientId, capability, scope) =>
      lock.withPermits(1)(
        Ref.get(state).pipe(
          Effect.map((current) => {
            const client = current.clients.find(
              (candidate) => candidate.clientId === clientId && candidate.capability === capability,
            );
            if (!client) return "revoked" as const;
            return client.scopes.includes(scope) ? ("authorized" as const) : ("forbidden" as const);
          }),
        ),
      ),
    withAuthorizedSession,
  });
});

export const layer = Layer.effect(ConnectionStore, make);
