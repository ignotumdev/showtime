import { NodeFileSystem, NodePath } from "@effect/platform-node";
import { DateTime, Effect, Layer, Schema } from "effect";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { ShowFileUpdateError, ShowId, ShowName } from "@showtime/contracts";
import { ShowFile } from "./ShowFile.js";
import * as ShowFileLayer from "./ShowFile.js";
import * as ShowPaths from "./ShowPaths.js";

const tempHomes = new Set<string>();
const showId = Schema.decodeUnknownSync(ShowId)("show_0123456789abcdef");
const decodeShowName = Schema.decodeUnknownSync(ShowName);

const makeTempHome = async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "showtime-home-"));
  tempHomes.add(home);
  return home;
};

const makeLayer = (home: string) =>
  ShowFileLayer.layer.pipe(
    Layer.provideMerge(ShowPaths.makeLayer(home)),
    Layer.provide(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer)),
  );

afterEach(async () => {
  await Promise.all(Array.from(tempHomes, (home) => rm(home, { recursive: true, force: true })));
  tempHomes.clear();
});

describe("ShowFile", () => {
  it("creates files using sanitized show-name-id.showtime filenames", async () => {
    const home = await makeTempHome();
    const filePath = await Effect.runPromise(
      Effect.gen(function* () {
        const showFile = yield* ShowFile;
        return yield* showFile.create({
          id: showId,
          name: "Main Hall / Night 1",
          color: "violet",
        });
      }).pipe(Effect.provide(makeLayer(home))),
    );

    expect(filePath).toBe(
      path.join(home, ".showtime", "shows", "main-hall-night-1-show_0123456789abcdef.showtime"),
    );

    const json = JSON.parse(await readFile(filePath, "utf8")) as unknown;
    expect(json).toMatchObject({
      type: "showtime-show",
      version: 1,
      config: {
        id: "show_0123456789abcdef",
        name: "Main Hall / Night 1",
        color: "violet",
      },
    });
  });

  it("updates through the service and refreshes updatedAt", async () => {
    const home = await makeTempHome();
    const filePath = path.join(
      home,
      ".showtime",
      "shows",
      "soundcheck-show_0123456789abcdef.showtime",
    );

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const showFile = yield* ShowFile;
        yield* showFile.create({ id: showId, name: "Soundcheck", color: "sky" });
        yield* Effect.sleep("10 millis");
        return yield* showFile.update(filePath, (document) => ({
          ...document,
          config: {
            ...document.config,
            name: decodeShowName("Soundcheck Updated"),
            color: "rose",
          },
        }));
      }).pipe(Effect.provide(makeLayer(home))),
    );

    const persisted = JSON.parse(await readFile(filePath, "utf8")) as {
      readonly type: "showtime-show";
      readonly version: 1;
      readonly config: {
        readonly name: string;
        readonly color: string;
        readonly createdAt: string;
        readonly updatedAt: string;
      };
    };

    expect(result.config.name).toBe("Soundcheck Updated");
    expect(result.config.color).toBe("rose");
    expect(persisted.type).toBe("showtime-show");
    expect(persisted.version).toBe(1);
    expect(persisted.config.name).toBe("Soundcheck Updated");
    expect(persisted.config.color).toBe("rose");
    expect(DateTime.toEpochMillis(result.config.updatedAt)).toBeGreaterThanOrEqual(
      DateTime.toEpochMillis(result.config.createdAt),
    );
    expect(persisted.config.updatedAt).not.toBe(persisted.config.createdAt);
    expect(await readFile(filePath, "utf8")).toMatch(/\n$/);
  });

  it("returns a typed error when an update callback throws", async () => {
    const home = await makeTempHome();

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const showFile = yield* ShowFile;
        const filePath = yield* showFile.create({
          id: showId,
          name: "Soundcheck",
          color: "sky",
        });

        return yield* Effect.result(
          showFile.update(filePath, () => {
            throw new Error("boom");
          }),
        );
      }).pipe(Effect.provide(makeLayer(home))),
    );

    expect(result._tag).toBe("Failure");
    if (result._tag !== "Failure") {
      throw new Error("Expected update to fail");
    }

    expect(result.failure).toBeInstanceOf(ShowFileUpdateError);
    expect(result.failure._tag).toBe("ShowFileUpdateError");
  });
});
