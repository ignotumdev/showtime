import { NodeSocket } from "@effect/platform-node";
import { Deferred, Effect, Layer, Stream } from "effect";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { ShowtimeRpcs, ShowName } from "@showtime/contracts";
import { makeBackendRuntime } from "./index.js";

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
  it("serves typed RPC calls over Effect Socket and disposes cleanly", async () => {
    const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "showtime-rpc-home-"));
    tempHomes.add(homeDirectory);
    const port = await findAvailablePort();
    const rpcPath = "/rpc/test" as const;
    const runtime = makeBackendRuntime({
      host: "127.0.0.1",
      port,
      rpcPath,
      homeDirectory,
    });

    await runtime.runPromise(Effect.void);
    try {
      const clientProtocol = RpcClient.layerProtocolSocket().pipe(
        Layer.provide(NodeSocket.layerWebSocket(`http://127.0.0.1:${port}${rpcPath}`)),
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
});
