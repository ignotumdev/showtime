import { NodeFileSystem, NodePath } from "@effect/platform-node";
import { Effect, Layer, PlatformError } from "effect";
import { FileSystem } from "effect/FileSystem";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { ShowDiscovery } from "./ShowDiscovery.js";
import * as ShowDiscoveryLayer from "./ShowDiscovery.js";
import * as ShowFile from "./ShowFile.js";
import * as ShowPaths from "./ShowPaths.js";

const tempHomes = new Set<string>();

const makeTempHome = async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "showtime-home-"));
  tempHomes.add(home);
  return home;
};

const makeLayer = (home: string) =>
  ShowDiscoveryLayer.layer.pipe(
    Layer.provideMerge(ShowFile.layer.pipe(Layer.provideMerge(ShowPaths.makeLayer(home)))),
    Layer.provide(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer)),
  );

const makeLayerWithStatFailure = (home: string, failedPath: string) => {
  const fileSystemLayer = Layer.effect(
    FileSystem,
    Effect.gen(function* () {
      const fs = yield* FileSystem;

      return FileSystem.of({
        ...fs,
        stat: (filePath) =>
          filePath === failedPath
            ? Effect.fail(
                PlatformError.systemError({
                  _tag: "NotFound",
                  module: "FileSystem",
                  method: "stat",
                  pathOrDescriptor: filePath,
                  description: "test stat failure",
                }),
              )
            : fs.stat(filePath),
      });
    }),
  ).pipe(Layer.provide(NodeFileSystem.layer));

  return ShowDiscoveryLayer.layer.pipe(
    Layer.provideMerge(ShowFile.layer.pipe(Layer.provideMerge(ShowPaths.makeLayer(home)))),
    Layer.provide(Layer.mergeAll(fileSystemLayer, NodePath.layer)),
  );
};

afterEach(async () => {
  await Promise.all(Array.from(tempHomes, (home) => rm(home, { recursive: true, force: true })));
  tempHomes.clear();
});

describe("ShowDiscovery", () => {
  it("creates the show directory and returns no files when it is empty", async () => {
    const home = await makeTempHome();
    const discovered = await Effect.runPromise(
      Effect.gen(function* () {
        const discovery = yield* ShowDiscovery;
        return yield* discovery.discover;
      }).pipe(Effect.provide(makeLayer(home))),
    );

    expect(discovered).toEqual([]);
  });

  it("discovers only regular .showtime files", async () => {
    const home = await makeTempHome();
    const showsDirectory = path.join(home, ".showtime", "shows");
    await mkdir(path.join(showsDirectory, "nested.showtime"), {
      recursive: true,
    });
    await writeFile(
      path.join(showsDirectory, "valid.showtime"),
      JSON.stringify({
        type: "showtime-show",
        version: 1,
        config: {
          id: "show_0123456789abcdef",
          name: "Valid",
          color: "green",
          createdAt: "2026-07-02T10:00:00.000Z",
          updatedAt: "2026-07-02T10:00:00.000Z",
        },
        microphones: [],
        mixes: [],
        songs: [],
      }),
    );
    await writeFile(
      path.join(showsDirectory, "invalid.showtime"),
      JSON.stringify({
        type: "showtime-show",
        version: 1,
        config: {
          id: "show_0123456789abcdef",
          name: "Invalid",
          color: "green",
          createdAt: "not-a-date",
          updatedAt: "2026-07-02T10:00:00.000Z",
        },
        microphones: [],
        mixes: [],
        songs: [],
      }),
    );
    await writeFile(path.join(showsDirectory, "notes.txt"), "ignore");

    const discovered = await Effect.runPromise(
      Effect.gen(function* () {
        const discovery = yield* ShowDiscovery;
        return yield* discovery.discover;
      }).pipe(Effect.provide(makeLayer(home))),
    );

    expect(discovered).toEqual([
      expect.objectContaining({
        path: path.join(showsDirectory, "valid.showtime"),
        document: expect.objectContaining({
          config: expect.objectContaining({ id: "show_0123456789abcdef", name: "Valid" }),
        }),
      }),
    ]);
  });

  it("skips files that cannot be statted and continues discovery", async () => {
    const home = await makeTempHome();
    const showsDirectory = path.join(home, ".showtime", "shows");
    const skippedPath = path.join(showsDirectory, "skip.showtime");
    const firstPath = path.join(showsDirectory, "first.showtime");
    const secondPath = path.join(showsDirectory, "second.showtime");
    await mkdir(showsDirectory, { recursive: true });
    const validDocument = {
      type: "showtime-show",
      version: 1,
      config: {
        id: "show_0123456789abcdef",
        name: "Valid",
        color: "green",
        createdAt: "2026-07-02T10:00:00.000Z",
        updatedAt: "2026-07-02T10:00:00.000Z",
      },
      microphones: [],
      mixes: [],
      songs: [],
    };
    await writeFile(firstPath, JSON.stringify(validDocument));
    await writeFile(skippedPath, JSON.stringify(validDocument));
    await writeFile(secondPath, JSON.stringify(validDocument));

    const discovered = await Effect.runPromise(
      Effect.gen(function* () {
        const discovery = yield* ShowDiscovery;
        return yield* discovery.discover;
      }).pipe(Effect.provide(makeLayerWithStatFailure(home, skippedPath))),
    );

    expect(discovered).toHaveLength(2);
    expect(discovered.map(({ path: filePath }) => filePath)).toEqual(
      expect.arrayContaining([firstPath, secondPath]),
    );
  });
});
