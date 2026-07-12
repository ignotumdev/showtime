import { NodeFileSystem, NodePath } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import * as Ids from "../ids/Ids.js";
import { ShowService } from "./ShowService.js";
import * as ShowServiceLayer from "./ShowService.js";
import * as ShowDiscovery from "./ShowDiscovery.js";
import * as ShowFile from "./ShowFile.js";
import * as ShowPaths from "./ShowPaths.js";
import * as ShowRepository from "./ShowRepository.js";

const tempHomes = new Set<string>();

const makeTempHome = async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "showtime-home-"));
  tempHomes.add(home);
  return home;
};

const makeLayer = (home: string) =>
  ShowServiceLayer.layer.pipe(
    Layer.provideMerge(Ids.layer),
    Layer.provideMerge(
      ShowRepository.layer.pipe(
        Layer.provideMerge(
          ShowDiscovery.layer.pipe(
            Layer.provideMerge(ShowFile.layer.pipe(Layer.provideMerge(ShowPaths.makeLayer(home)))),
          ),
        ),
      ),
    ),
    Layer.provide(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer)),
  );

afterEach(async () => {
  await Promise.all(Array.from(tempHomes, (home) => rm(home, { recursive: true, force: true })));
  tempHomes.clear();
});

describe("ShowService", () => {
  it("creates, lists, renames, and deletes shows", async () => {
    const home = await makeTempHome();
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const shows = yield* ShowService;

        const created = yield* shows.create({ name: "Soundcheck", color: "sky" });
        const afterCreate = yield* shows.list;
        const edited = yield* shows.edit({ id: created.id, name: "Main Set", color: "rose" });
        const afterRename = yield* shows.list;
        yield* shows.delete(created.id);
        const afterDelete = yield* shows.list;

        return { afterCreate, afterDelete, afterRename, created, edited };
      }).pipe(Effect.provide(makeLayer(home))),
    );

    expect(result.created.name).toBe("Soundcheck");
    expect(result.created.color).toBe("sky");
    expect(result.afterCreate.map((show) => show.name)).toEqual(["Soundcheck"]);
    expect(result.edited.name).toBe("Main Set");
    expect(result.edited.color).toBe("rose");
    expect(result.afterRename.map((show) => show.name)).toEqual(["Main Set"]);
    expect(result.afterRename.map((show) => show.color)).toEqual(["rose"]);
    expect(result.afterDelete).toEqual([]);
  });

  it("serves and updates the in-memory document without rereading a damaged file", async () => {
    const home = await makeTempHome();
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const shows = yield* ShowService;
        const repository = yield* ShowRepository.ShowRepository;
        const created = yield* shows.create({ name: "Cached", color: "sky" });
        const entry = yield* repository.findById(created.id);

        yield* Effect.promise(() => writeFile(entry.path, "not valid json", "utf8"));
        const fromMemory = yield* shows.list;
        const edited = yield* shows.edit({ id: created.id, name: "Still Cached", color: "rose" });
        return { fromMemory, edited };
      }).pipe(Effect.provide(makeLayer(home))),
    );

    expect(result.fromMemory.map((show) => show.name)).toEqual(["Cached"]);
    expect(result.edited).toMatchObject({ name: "Still Cached", color: "rose" });
  });
});
