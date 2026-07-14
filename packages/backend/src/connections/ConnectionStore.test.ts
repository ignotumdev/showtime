import { NodeFileSystem, NodePath } from "@effect/platform-node";
import { Deferred, Effect, Exit, Fiber, Layer } from "effect";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import * as HomeDirectory from "../platform/HomeDirectory.js";
import { ConnectionStore, layer } from "./ConnectionStore.js";

const tempHomes = new Set<string>();

afterEach(async () => {
  await Promise.all(Array.from(tempHomes, (home) => rm(home, { recursive: true, force: true })));
  tempHomes.clear();
});

const testLayer = (homeDirectory: string) =>
  layer.pipe(
    Layer.provide(
      Layer.mergeAll(NodeFileSystem.layer, NodePath.layer, HomeDirectory.makeLayer(homeDirectory)),
    ),
  );

describe("ConnectionStore session admission", () => {
  it("assigns incrementing labels when client labels are omitted", async () => {
    const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "showtime-store-home-"));
    tempHomes.add(homeDirectory);

    const names = await Effect.runPromise(
      Effect.gen(function* () {
        const store = yield* ConnectionStore;
        const first = yield* store.createInvitation();
        const custom = yield* store.createInvitation("Monitor iPad");
        const second = yield* store.createInvitation("   ");
        return [first.name, custom.name, second.name];
      }).pipe(Effect.provide(testLayer(homeDirectory))),
    );

    expect(names).toEqual(["Client 1", "Monitor iPad", "Client 2"]);
  });

  it("ignores numeric suffixes whose successor cannot be represented safely", async () => {
    const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "showtime-store-home-"));
    tempHomes.add(homeDirectory);
    const directory = path.join(homeDirectory, ".showtime");
    const filePath = path.join(directory, "connections.json");
    const clients = [
      "Client 4",
      `Client ${Number.MAX_SAFE_INTEGER}`,
      "Client 9007199254740992",
    ].map((name, index) => ({
      clientId: `00000000000000000000${index}`,
      name,
      capability: `000000000000000000000000000000000000000000${index}`,
      createdAt: "2026-07-12T20:10:10.266Z",
    }));
    await mkdir(directory);
    await writeFile(filePath, JSON.stringify({ version: 1, clients, invitations: [] }));

    const name = await Effect.runPromise(
      Effect.gen(function* () {
        const store = yield* ConnectionStore;
        return (yield* store.createInvitation()).name;
      }).pipe(Effect.provide(testLayer(homeDirectory))),
    );

    expect(name).toBe("Client 5");
  });

  it("loads version 1 connection data without rewriting it", async () => {
    const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "showtime-store-home-"));
    tempHomes.add(homeDirectory);
    const directory = path.join(homeDirectory, ".showtime");
    const filePath = path.join(directory, "connections.json");
    const client = {
      clientId: "XZv7X7qpOMA1cEm9VQxF6",
      name: "Monitor iPad",
      capability: "QdMNx4sOay_y4bjoiZkruXPGCI6k8Gm32ETBgCecz7Q",
      createdAt: "2026-07-12T20:10:10.266Z",
      scopes: [],
    };
    await mkdir(directory);
    await writeFile(filePath, JSON.stringify({ version: 1, clients: [client], invitations: [] }));

    const clients = await Effect.runPromise(
      Effect.gen(function* () {
        const store = yield* ConnectionStore;
        return yield* store.clients;
      }).pipe(Effect.provide(testLayer(homeDirectory))),
    );

    expect(clients).toEqual([client]);
    expect(JSON.parse(await readFile(filePath, "utf8"))).toEqual({
      version: 1,
      clients: [client],
      invitations: [],
    });
  });

  it("copies invitation scopes to the paired client and authorizes each scope independently", async () => {
    const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "showtime-store-home-"));
    tempHomes.add(homeDirectory);

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const store = yield* ConnectionStore;
        const invitation = yield* store.createInvitation("Manager iPad", [
          "connections:read",
          "connections:create",
        ]);
        const credentials = yield* store.consumeInvitation(invitation.token);
        if (!credentials) return undefined;
        return {
          credentials,
          clients: yield* store.clients,
          read: yield* store.scopeAuthorization(
            credentials.clientId,
            credentials.capability,
            "connections:read",
          ),
          create: yield* store.scopeAuthorization(
            credentials.clientId,
            credentials.capability,
            "connections:create",
          ),
          remove: yield* store.scopeAuthorization(
            credentials.clientId,
            credentials.capability,
            "connections:delete",
          ),
        };
      }).pipe(Effect.provide(testLayer(homeDirectory))),
    );

    expect(result?.credentials.scopes).toEqual(["connections:read", "connections:create"]);
    expect(result?.clients[0]?.scopes).toEqual(["connections:read", "connections:create"]);
    expect(result).toMatchObject({
      read: "authorized",
      create: "authorized",
      remove: "forbidden",
    });
  });

  it("serializes registration with revocation so an admitted session cannot escape closing", async () => {
    const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "showtime-store-home-"));
    tempHomes.add(homeDirectory);

    const interrupted = await Effect.runPromise(
      Effect.gen(function* () {
        const store = yield* ConnectionStore;
        const invitation = yield* store.createInvitation("Monitor iPad", []);
        const credentials = yield* store.consumeInvitation(invitation.token);
        if (!credentials) return false;

        const authorizationStarted = yield* Deferred.make<void>();
        const finishAuthorization = yield* Deferred.make<void>();
        const session = yield* Effect.forkChild(
          store.withAuthorizedSession(
            credentials.clientId,
            credentials.capability,
            Deferred.succeed(authorizationStarted, undefined).pipe(
              Effect.andThen(Deferred.await(finishAuthorization)),
              Effect.as(true),
            ),
            Effect.never,
          ),
        );

        yield* Deferred.await(authorizationStarted);
        const revocation = yield* Effect.forkChild(store.remove(credentials.clientId));
        yield* Deferred.succeed(finishAuthorization, undefined);
        yield* Fiber.join(revocation);
        return Exit.isFailure(yield* Fiber.await(session));
      }).pipe(Effect.provide(testLayer(homeDirectory))),
    );

    expect(interrupted).toBe(true);
  });

  it("rechecks authorization before registering a session", async () => {
    const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "showtime-store-home-"));
    tempHomes.add(homeDirectory);

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const store = yield* ConnectionStore;
        const invitation = yield* store.createInvitation("Monitor iPad", []);
        const credentials = yield* store.consumeInvitation(invitation.token);
        if (!credentials) return "missing credentials";
        yield* store.remove(credentials.clientId);
        return yield* store.withAuthorizedSession(
          credentials.clientId,
          credentials.capability,
          Effect.succeed(true),
          Effect.succeed("connected"),
        );
      }).pipe(Effect.provide(testLayer(homeDirectory))),
    );

    expect(result).toBeUndefined();
  });

  it("serializes registration with disconnect-all so a late session is included", async () => {
    const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "showtime-store-home-"));
    tempHomes.add(homeDirectory);

    const interrupted = await Effect.runPromise(
      Effect.gen(function* () {
        const store = yield* ConnectionStore;
        const invitation = yield* store.createInvitation("Monitor iPad", []);
        const credentials = yield* store.consumeInvitation(invitation.token);
        if (!credentials) return false;

        const enabledCheckStarted = yield* Deferred.make<void>();
        const finishEnabledCheck = yield* Deferred.make<void>();
        const session = yield* Effect.forkChild(
          store.withAuthorizedSession(
            credentials.clientId,
            credentials.capability,
            Deferred.succeed(enabledCheckStarted, undefined).pipe(
              Effect.andThen(Deferred.await(finishEnabledCheck)),
              Effect.as(true),
            ),
            Effect.never,
          ),
        );

        yield* Deferred.await(enabledCheckStarted);
        const disconnect = yield* Effect.forkChild(store.disconnectAll);
        yield* Deferred.succeed(finishEnabledCheck, undefined);
        yield* Fiber.join(disconnect);
        return Exit.isFailure(yield* Fiber.await(session));
      }).pipe(Effect.provide(testLayer(homeDirectory))),
    );

    expect(interrupted).toBe(true);
  });
});
