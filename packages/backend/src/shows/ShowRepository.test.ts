import { Effect, Layer, Schema } from "effect";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { ShowId } from "@showtime/contracts";
import { makeDatabaseTestLayer } from "../database/DatabaseTest.js";
import * as Ids from "../ids/Ids.js";
import { ShowService } from "./ShowService.js";
import * as ShowServiceLayer from "./ShowService.js";
import { ShowRepository } from "./ShowRepository.js";
import * as ShowRepositoryLayer from "./ShowRepository.js";

const homes = new Set<string>();
afterEach(async () => {
  await Promise.all(Array.from(homes, (home) => rm(home, { recursive: true, force: true })));
  homes.clear();
});

const makeLayer = (home: string) =>
  ShowServiceLayer.layer.pipe(
    Layer.provideMerge(ShowRepositoryLayer.layer),
    Layer.provideMerge(Ids.layer),
    Layer.provide(makeDatabaseTestLayer(home)),
  );

describe("ShowRepository", () => {
  it("keeps the repository ID immutable when an update callback changes config.id", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "showtime-show-repository-"));
    homes.add(home);
    const replacementId = Schema.decodeUnknownSync(ShowId)("show_fedcba9876543210");
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const shows = yield* ShowService;
        const repository = yield* ShowRepository;
        const created = yield* shows.create({ name: "Original", color: "sky" });
        const updated = yield* repository.update(created.id, (document) => ({
          ...document,
          config: { ...document.config, id: replacementId },
        }));
        return {
          updated,
          found: yield* repository.findById(created.id),
          replacement: yield* Effect.result(repository.findById(replacementId)),
        };
      }).pipe(Effect.provide(makeLayer(home))),
    );
    expect(result.updated.config.id).not.toBe(replacementId);
    expect(result.found.config.id).toBe(result.updated.config.id);
    expect(result.replacement._tag).toBe("Failure");
  });
});
