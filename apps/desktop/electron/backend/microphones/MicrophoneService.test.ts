import { NodeFileSystem, NodePath } from "@effect/platform-node";
import { DateTime, Effect, Layer } from "effect";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import * as Ids from "../ids/Ids";
import * as ShowDiscovery from "../shows/ShowDiscovery";
import * as ShowFile from "../shows/ShowFile";
import * as ShowPaths from "../shows/ShowPaths";
import * as ShowRepository from "../shows/ShowRepository";
import { ShowService } from "../shows/ShowService";
import * as ShowServiceLayer from "../shows/ShowService";
import { MicrophoneService } from "./MicrophoneService";
import * as MicrophoneServiceLayer from "./MicrophoneService";

const tempHomes = new Set<string>();
afterEach(async () => {
  await Promise.all(Array.from(tempHomes, (home) => rm(home, { recursive: true, force: true })));
  tempHomes.clear();
});

const makeLayer = (home: string) => {
  const files = ShowDiscovery.layer.pipe(
    Layer.provideMerge(ShowFile.layer.pipe(Layer.provideMerge(ShowPaths.makeLayer(home)))),
  );
  const repository = ShowRepository.layer.pipe(Layer.provideMerge(files));
  return Layer.mergeAll(ShowServiceLayer.layer, MicrophoneServiceLayer.layer).pipe(
    Layer.provideMerge(Layer.mergeAll(Ids.layer, repository)),
    Layer.provide(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer)),
  );
};

describe("MicrophoneService", () => {
  it("persists creation and edits while allowing duplicate numbers", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "showtime-home-"));
    tempHomes.add(home);
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const shows = yield* ShowService;
        const microphones = yield* MicrophoneService;
        const show = yield* shows.create({ name: "Soundcheck", color: "sky" });
        const first = yield* microphones.create({ showId: show.id, color: "rose" });
        const second = yield* microphones.create({ showId: show.id, color: "blue" });
        yield* microphones.edit({
          showId: show.id,
          id: second.id,
          number: first.number,
          color: "emerald",
          name: "Lead vocal",
        });
        yield* microphones.edit({
          showId: show.id,
          id: second.id,
          number: first.number,
          color: "amber",
        });
        const afterEditWithoutName = yield* microphones.list(show.id);
        yield* microphones.delete({ showId: show.id, id: first.id });
        const afterDelete = yield* microphones.list(show.id);
        const repository = yield* ShowRepository.ShowRepository;
        const persisted = yield* repository.findById(show.id);
        return {
          afterDelete,
          afterEditWithoutName,
          first,
          persisted: persisted.document.microphones,
        };
      }).pipe(Effect.provide(makeLayer(home))),
    );

    expect(result.afterEditWithoutName.map(({ number }) => number)).toEqual([1, 1]);
    expect(result.afterEditWithoutName[1]).toMatchObject({ color: "amber", name: "Lead vocal" });
    expect(result.afterDelete).toEqual([result.afterEditWithoutName[1]]);
    expect(result.first.createdAt).toEqual(result.first.updatedAt);
    expect(
      DateTime.toEpochMillis(result.afterEditWithoutName[1]!.updatedAt),
    ).toBeGreaterThanOrEqual(DateTime.toEpochMillis(result.afterEditWithoutName[1]!.createdAt));
    expect(result.persisted).toHaveLength(2);
    expect(result.persisted[0]!.deletedAt).toBeDefined();
    expect(result.persisted[0]!.updatedAt).toEqual(result.persisted[0]!.deletedAt);
  });
});
