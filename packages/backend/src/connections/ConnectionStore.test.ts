import { Deferred, Effect, Fiber, Layer } from "effect";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { makeDatabaseTestLayer } from "../database/DatabaseTest.js";
import * as Ids from "../ids/Ids.js";
import { ProfileService } from "../profiles/ProfileService.js";
import * as ProfileServiceLayer from "../profiles/ProfileService.js";
import { ConnectionStore, layer } from "./ConnectionStore.js";

const homes = new Set<string>();
afterEach(async () => {
  await Promise.all(Array.from(homes, (home) => rm(home, { recursive: true, force: true })));
  homes.clear();
});

const testLayer = (home: string) =>
  Layer.mergeAll(layer, ProfileServiceLayer.layer).pipe(
    Layer.provideMerge(Ids.layer),
    Layer.provide(makeDatabaseTestLayer(home)),
  );

describe("ConnectionStore", () => {
  it("assigns incrementing labels when labels are omitted", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "showtime-connections-"));
    homes.add(home);
    const names = await Effect.runPromise(
      Effect.gen(function* () {
        const store = yield* ConnectionStore;
        const profileId = (yield* (yield* ProfileService).list).defaultProfileId;
        const first = yield* store.createInvitation(undefined, profileId);
        const custom = yield* store.createInvitation("Monitor iPad", profileId);
        const second = yield* store.createInvitation("   ", profileId);
        return [first.name, custom.name, second.name];
      }).pipe(Effect.provide(testLayer(home))),
    );
    expect(names).toEqual(["Client 1", "Monitor iPad", "Client 2"]);
  });

  it("copies strict invitation scopes to a paired client", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "showtime-connections-"));
    homes.add(home);
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const store = yield* ConnectionStore;
        const profileId = (yield* (yield* ProfileService).list).defaultProfileId;
        const invitation = yield* store.createInvitation(undefined, profileId, [
          "connections:read",
          "connections:create",
        ]);
        const credentials = (yield* store.consumeInvitation(invitation.token))!;
        return {
          credentials,
          clients: yield* store.clients,
          read: yield* store.scopeAuthorization(
            credentials.clientId,
            credentials.capability,
            "connections:read",
          ),
          remove: yield* store.scopeAuthorization(
            credentials.clientId,
            credentials.capability,
            "connections:delete",
          ),
        };
      }).pipe(Effect.provide(testLayer(home))),
    );
    expect(result.credentials.scopes).toEqual(["connections:read", "connections:create"]);
    expect(result.clients[0]?.scopes).toEqual(result.credentials.scopes);
    expect(result.read).toBe("authorized");
    expect(result.remove).toBe("forbidden");
  });

  it("interrupts admitted sessions after revocation", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "showtime-connections-"));
    homes.add(home);
    const interrupted = await Effect.runPromise(
      Effect.gen(function* () {
        const store = yield* ConnectionStore;
        const profileId = (yield* (yield* ProfileService).list).defaultProfileId;
        const invitation = yield* store.createInvitation(undefined, profileId);
        const credentials = (yield* store.consumeInvitation(invitation.token))!;
        const entered = yield* Deferred.make<void>();
        const fiber = yield* store
          .withAuthorizedSession(
            credentials.clientId,
            credentials.capability,
            Effect.succeed(true),
            Deferred.succeed(entered, undefined).pipe(Effect.andThen(Effect.never)),
          )
          .pipe(Effect.forkChild);
        yield* Deferred.await(entered);
        yield* store.remove(credentials.clientId);
        return yield* Fiber.await(fiber);
      }).pipe(Effect.provide(testLayer(home))),
    );
    expect(interrupted._tag).toBe("Failure");
  });
});
