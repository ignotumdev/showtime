import { NodeFileSystem, NodePath } from "@effect/platform-node";
import { Effect, Layer, Schema } from "effect";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { RpcError, ShowId } from "@showtime/contracts";
import * as ShowDiscovery from "./ShowDiscovery.js";
import { ShowFile } from "./ShowFile.js";
import * as ShowFileLayer from "./ShowFile.js";
import * as ShowPaths from "./ShowPaths.js";
import { ShowRepository } from "./ShowRepository.js";
import * as ShowRepositoryLayer from "./ShowRepository.js";

const tempHomes = new Set<string>();
const decodeShowId = Schema.decodeUnknownSync(ShowId);
const originalId = decodeShowId("show_0123456789abcdef");
const replacementId = decodeShowId("show_fedcba9876543210");

const makeTempHome = async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "showtime-home-"));
  tempHomes.add(home);
  return home;
};

const makeShowFileLayer = (home: string) =>
  ShowFileLayer.layer.pipe(
    Layer.provideMerge(ShowPaths.makeLayer(home)),
    Layer.provide(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer)),
  );

const makeRepositoryLayer = (home: string) =>
  ShowRepositoryLayer.layer.pipe(
    Layer.provideMerge(ShowDiscovery.layer.pipe(Layer.provideMerge(makeShowFileLayer(home)))),
    Layer.provide(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer)),
  );

afterEach(async () => {
  await Promise.all(Array.from(tempHomes, (home) => rm(home, { recursive: true, force: true })));
  tempHomes.clear();
});

describe("ShowRepository", () => {
  it("fails discovery explicitly when files contain duplicate show IDs", async () => {
    const home = await makeTempHome();
    await Effect.runPromise(
      Effect.gen(function* () {
        const showFile = yield* ShowFile;
        yield* showFile.create({ id: originalId, name: "First", color: "sky" });
        yield* showFile.create({ id: originalId, name: "Second", color: "rose" });
      }).pipe(Effect.provide(makeShowFileLayer(home))),
    );

    const result = await Effect.runPromise(
      Effect.result(
        Effect.gen(function* () {
          yield* ShowRepository;
        }).pipe(Effect.provide(makeRepositoryLayer(home))),
      ),
    );

    expect(result._tag).toBe("Failure");
    if (result._tag !== "Failure") throw new Error("Expected duplicate discovery to fail");
    expect(result.failure).toBeInstanceOf(RpcError);
    expect(result.failure.message).toContain(`Duplicate show ID ${originalId}`);
  });

  it("keeps the repository ID immutable when an update callback changes config.id", async () => {
    const home = await makeTempHome();
    const filePath = await Effect.runPromise(
      Effect.gen(function* () {
        const showFile = yield* ShowFile;
        return yield* showFile.create({ id: originalId, name: "Original", color: "sky" });
      }).pipe(Effect.provide(makeShowFileLayer(home))),
    );

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const repository = yield* ShowRepository;
        const updated = yield* repository.update(originalId, (document) => ({
          ...document,
          config: { ...document.config, id: replacementId },
        }));
        const found = yield* repository.findById(originalId);
        const replacement = yield* Effect.result(repository.findById(replacementId));
        return { found, replacement, updated };
      }).pipe(Effect.provide(makeRepositoryLayer(home))),
    );

    const persisted = JSON.parse(await readFile(filePath, "utf8")) as {
      readonly config: { readonly id: string };
    };
    expect(result.updated.document.config.id).toBe(originalId);
    expect(result.found.document.config.id).toBe(originalId);
    expect(result.replacement._tag).toBe("Failure");
    expect(persisted.config.id).toBe(originalId);
  });
});
