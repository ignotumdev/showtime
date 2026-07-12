import { NodeSocket } from "@effect/platform-node";
import { Deferred, Effect, Layer, Stream } from "effect";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";
import { createServer } from "node:net";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { ShowtimeRpcs, ShowName } from "@showtime/contracts";
import { ConnectionManager, makeBackendRuntime } from "./index.js";

const tempHomes = new Set<string>();

afterEach(async () => {
  await Promise.all(Array.from(tempHomes, (home) => rm(home, { recursive: true, force: true })));
  tempHomes.clear();
});

const findAvailablePort = () =>
  new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close();
        reject(new Error("Could not allocate a TCP port"));
        return;
      }
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });

describe("Showtime WebSocket RPC", () => {
  it("serves the bundled web app without exposing an unauthenticated RPC route", async () => {
    const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "showtime-http-home-"));
    tempHomes.add(homeDirectory);
    const webRoot = path.join(homeDirectory, "web");
    await mkdir(webRoot);
    await writeFile(path.join(webRoot, "index.html"), "<html>Showtime local</html>");
    const port = await findAvailablePort();
    const runtime = makeBackendRuntime({
      host: "127.0.0.1",
      port,
      homeDirectory,
      webRoot,
    });

    await runtime.runPromise(Effect.void);
    try {
      const page = await fetch(`http://127.0.0.1:${port}/`);
      expect(page.status).toBe(200);
      expect(await page.text()).toContain("Showtime local");
      const unauthenticated = await fetch(`http://127.0.0.1:${port}/rpc`);
      expect(unauthenticated.status).toBe(404);
    } finally {
      await runtime.dispose();
    }
  });

  it("serves typed RPC calls over Effect Socket and disposes cleanly", async () => {
    const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "showtime-rpc-home-"));
    tempHomes.add(homeDirectory);
    const port = await findAvailablePort();
    const runtime = makeBackendRuntime({
      host: "127.0.0.1",
      port,
      homeDirectory,
    });

    await runtime.runPromise(Effect.void);
    try {
      const rpcWebSocketUrl = await runtime.runPromise(
        Effect.flatMap(ConnectionManager, (connections) => connections.rpcWebSocketUrl),
      );
      const clientProtocol = RpcClient.layerProtocolSocket().pipe(
        Layer.provide(NodeSocket.layerWebSocket(rpcWebSocketUrl)),
        Layer.provide(RpcSerialization.layerJson),
      );
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const client = yield* RpcClient.make(ShowtimeRpcs);
          const firstSnapshot = yield* Deferred.make<void>();
          const snapshotsEffect = client["shows.list"]().pipe(
            Stream.tap(() => Deferred.succeed(firstSnapshot, void 0)),
            Stream.take(2),
            Stream.runCollect,
          );
          const createEffect = Deferred.await(firstSnapshot).pipe(
            Effect.andThen(
              client["shows.create"]({
                name: ShowName.make("WebSocket Soundcheck"),
                color: "blue",
              }),
            ),
          );
          const [snapshots, created] = yield* Effect.all([snapshotsEffect, createEffect], {
            concurrency: "unbounded",
          });
          return { snapshots: Array.from(snapshots), created };
        }).pipe(Effect.scoped, Effect.provide(clientProtocol)),
      );

      expect(result.snapshots[0]).toEqual([]);
      expect(result.created.name).toBe("WebSocket Soundcheck");
      expect(result.snapshots[1]?.map((show) => show.id)).toEqual([result.created.id]);
    } finally {
      await runtime.dispose();
    }
  });

  it("broadcasts authoritative snapshots between independent WebSocket clients", async () => {
    const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "showtime-sync-home-"));
    tempHomes.add(homeDirectory);
    const port = await findAvailablePort();
    const runtime = makeBackendRuntime({ host: "127.0.0.1", port, homeDirectory });

    await runtime.runPromise(Effect.void);
    try {
      const rpcWebSocketUrl = await runtime.runPromise(
        Effect.flatMap(ConnectionManager, (connections) => connections.rpcWebSocketUrl),
      );
      const protocol = () =>
        RpcClient.layerProtocolSocket().pipe(
          Layer.provide(NodeSocket.layerWebSocket(rpcWebSocketUrl)),
          Layer.provide(RpcSerialization.layerJson),
        );
      const firstSnapshot = await Effect.runPromise(Deferred.make<void>());
      const snapshotsPromise = Effect.runPromise(
        Effect.gen(function* () {
          const client = yield* RpcClient.make(ShowtimeRpcs);
          return yield* client["shows.list"]().pipe(
            Stream.tap(() => Deferred.succeed(firstSnapshot, void 0)),
            Stream.take(2),
            Stream.runCollect,
          );
        }).pipe(Effect.scoped, Effect.timeout("5 seconds"), Effect.provide(protocol())),
      );

      await Effect.runPromise(Deferred.await(firstSnapshot).pipe(Effect.timeout("5 seconds")));
      const created = await Effect.runPromise(
        Effect.gen(function* () {
          const client = yield* RpcClient.make(ShowtimeRpcs);
          return yield* client["shows.create"]({
            name: ShowName.make("Synced from another device"),
            color: "green",
          });
        }).pipe(Effect.scoped, Effect.timeout("5 seconds"), Effect.provide(protocol())),
      );
      const snapshots = Array.from(await snapshotsPromise);

      expect(snapshots[0]).toEqual([]);
      expect(snapshots[1]?.map((show) => show.id)).toEqual([created.id]);
    } finally {
      await runtime.dispose();
    }
  });

  it("pairs once, tracks presence, revokes access, and disables remote hosting", async () => {
    const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "showtime-connections-home-"));
    tempHomes.add(homeDirectory);
    const webRoot = path.join(homeDirectory, "web");
    await mkdir(webRoot);
    await writeFile(path.join(webRoot, "index.html"), "<html>Showtime local</html>");
    const port = await findAvailablePort();
    const runtime = makeBackendRuntime({ host: "127.0.0.1", port, homeDirectory, webRoot });

    await runtime.runPromise(Effect.void);
    try {
      const pending = await runtime.runPromise(
        Effect.flatMap(ConnectionManager, (connections) =>
          connections.createInvitation("Monitor iPad"),
        ),
      );
      expect(pending.clients[0]).toMatchObject({ kind: "pending", name: "Monitor iPad" });
      const persisted = JSON.parse(
        await readFile(path.join(homeDirectory, ".showtime", "connections.json"), "utf8"),
      ) as {
        invitations: Array<{ token: string }>;
      };
      const token = persisted.invitations[0]!.token;
      const pairing = await fetch(`http://127.0.0.1:${port}/pair/${token}`, { method: "POST" });
      expect(pairing.status).toBe(200);
      const connection = (await pairing.json()) as { clientId: string; capability: string };
      expect(connection.clientId).toMatch(/^[A-Za-z0-9_-]{21}$/);
      expect(
        (await fetch(`http://127.0.0.1:${port}/pair/${token}`, { method: "POST" })).status,
      ).toBe(410);

      const rpcUrl = `http://127.0.0.1:${port}/rpc/${connection.clientId}/${connection.capability}`;
      expect((await fetch(rpcUrl)).status).not.toBe(404);

      const socket = new WebSocket(rpcUrl.replace("http:", "ws:"));
      await new Promise<void>((resolve, reject) => {
        socket.addEventListener("open", () => resolve(), { once: true });
        socket.addEventListener("error", () => reject(new Error("WebSocket failed")), {
          once: true,
        });
      });
      const connectedState = await runtime.runPromise(
        Effect.flatMap(ConnectionManager, (connections) => connections.connectionsState),
      );
      expect(connectedState.clients[0]).toMatchObject({
        kind: "paired",
        name: "Monitor iPad",
        connected: true,
      });

      const disabledClose = new Promise<void>((resolve) =>
        socket.addEventListener("close", () => resolve(), { once: true }),
      );
      await runtime.runPromise(
        Effect.flatMap(ConnectionManager, (connections) =>
          connections.setConnectionsEnabled(false),
        ),
      );
      await disabledClose;
      expect((await fetch(`http://127.0.0.1:${port}/`)).status).toBe(404);
      const settings = JSON.parse(
        await readFile(path.join(homeDirectory, ".showtime", "settings.json"), "utf8"),
      );
      expect(settings).toEqual({ version: 1, connectionsEnabled: false });

      await runtime.runPromise(
        Effect.flatMap(ConnectionManager, (connections) => connections.setConnectionsEnabled(true)),
      );
      const resumedSocket = new WebSocket(rpcUrl.replace("http:", "ws:"));
      await new Promise<void>((resolve, reject) => {
        resumedSocket.addEventListener("open", () => resolve(), { once: true });
        resumedSocket.addEventListener("error", () => reject(new Error("WebSocket failed")), {
          once: true,
        });
      });
      const revokedClose = new Promise<void>((resolve) =>
        resumedSocket.addEventListener("close", () => resolve(), { once: true }),
      );
      await runtime.runPromise(
        Effect.flatMap(ConnectionManager, (connections) =>
          connections.removeConnection(connection.clientId),
        ),
      );
      await revokedClose;
      expect((await fetch(rpcUrl)).status).toBe(404);
    } finally {
      await runtime.dispose();
    }
  });

  it("keeps expired invitations and renews them when Connect is opened", async () => {
    const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "showtime-expired-home-"));
    tempHomes.add(homeDirectory);
    const showtimeDirectory = path.join(homeDirectory, ".showtime");
    await mkdir(showtimeDirectory);
    const expiredToken = "x".repeat(43);
    await writeFile(
      path.join(showtimeDirectory, "connections.json"),
      JSON.stringify({
        version: 2,
        clients: [],
        invitations: [
          {
            invitationId: "expiredInvitation1234",
            name: "Expired iPad",
            token: expiredToken,
            expiresAt: "2000-01-01T00:00:00.000Z",
          },
        ],
      }),
    );
    const port = await findAvailablePort();
    const runtime = makeBackendRuntime({ host: "127.0.0.1", port, homeDirectory });
    await runtime.runPromise(Effect.void);
    try {
      const before = await runtime.runPromise(
        Effect.flatMap(ConnectionManager, (connections) => connections.connectionsState),
      );
      expect(before.clients[0]).toMatchObject({ kind: "pending", name: "Expired iPad" });
      await runtime.runPromise(
        Effect.flatMap(ConnectionManager, (connections) =>
          connections.pairingInfo("expiredInvitation1234"),
        ),
      );
      const persisted = JSON.parse(
        await readFile(path.join(showtimeDirectory, "connections.json"), "utf8"),
      ) as { invitations: Array<{ token: string; expiresAt: string }> };
      expect(persisted.invitations[0]!.token).not.toBe(expiredToken);
      expect(Date.parse(persisted.invitations[0]!.expiresAt)).toBeGreaterThan(Date.now());
      expect(
        (await fetch(`http://127.0.0.1:${port}/pair/${expiredToken}`, { method: "POST" })).status,
      ).toBe(410);
    } finally {
      await runtime.dispose();
    }
  });
});
