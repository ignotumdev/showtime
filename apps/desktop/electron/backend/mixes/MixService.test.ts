import { NodeFileSystem, NodePath } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { mainMixId } from "@showtime/contracts";
import * as Ids from "../ids/Ids";
import * as ShowDiscovery from "../shows/ShowDiscovery";
import * as ShowFile from "../shows/ShowFile";
import * as ShowPaths from "../shows/ShowPaths";
import * as ShowRepository from "../shows/ShowRepository";
import { ShowService } from "../shows/ShowService";
import * as ShowServiceLayer from "../shows/ShowService";
import { MixService } from "./MixService";
import * as MixServiceLayer from "./MixService";

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
  return Layer.mergeAll(ShowServiceLayer.layer, MixServiceLayer.layer).pipe(
    Layer.provideMerge(Layer.mergeAll(Ids.layer, repository)),
    Layer.provide(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer)),
  );
};

describe("MixService", () => {
  it("creates Main by default, allows renaming it, and refuses to delete it", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "showtime-home-"));
    tempHomes.add(home);
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const shows = yield* ShowService;
        const mixes = yield* MixService;
        const show = yield* shows.create({ name: "Soundcheck", color: "sky" });
        const initial = yield* mixes.list(show.id);
        const renamed = yield* mixes.edit({
          showId: show.id,
          id: initial[0]!.id,
          number: initial[0]!.number,
          color: initial[0]!.color,
          name: "House",
        });
        const deletion = yield* Effect.result(
          mixes.delete({ showId: show.id, id: initial[0]!.id }),
        );
        const added = yield* mixes.create({ showId: show.id, color: "rose" });
        yield* mixes.delete({ showId: show.id, id: added.id });
        return { initial, renamed, deletion, added, final: yield* mixes.list(show.id) };
      }).pipe(Effect.provide(makeLayer(home))),
    );

    expect(result.initial).toHaveLength(1);
    expect(result.initial[0]).toMatchObject({ id: mainMixId, name: "Main", number: "LR" });
    expect(result.renamed).toMatchObject({ id: mainMixId, name: "House" });
    expect(result.deletion._tag).toBe("Failure");
    expect(result.added.number).toBe("1");
    expect(result.final).toHaveLength(1);
    expect(result.final[0]).toMatchObject({ id: mainMixId, name: "House" });
  });
});
