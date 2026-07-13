import { NodeFileSystem, NodePath } from "@effect/platform-node";
import { ProfileName, profileIdPrefix } from "@showtime/contracts";
import { Effect, Layer } from "effect";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as HomeDirectory from "../platform/HomeDirectory.js";
import * as Ids from "../ids/Ids.js";
import { ProfileService, layer } from "./ProfileService.js";

const homes: Array<string> = [];

const withService = async <A>(home: string, effect: Effect.Effect<A, unknown, ProfileService>) =>
  Effect.runPromise(
    effect.pipe(
      Effect.provide(
        layer.pipe(
          Layer.provide(Ids.layer),
          Layer.provide(
            Layer.mergeAll(NodeFileSystem.layer, NodePath.layer, HomeDirectory.makeLayer(home)),
          ),
        ),
      ),
    ),
  );

afterEach(async () => {
  await Promise.all(homes.splice(0).map((home) => rm(home, { recursive: true, force: true })));
});

describe("ProfileService", () => {
  it("persists a normal generated default and protects the current default from deletion", async () => {
    const home = await mkdtemp(join(tmpdir(), "showtime-profiles-"));
    homes.push(home);

    const state = await withService(
      home,
      Effect.gen(function* () {
        const profiles = yield* ProfileService;
        return yield* profiles.list;
      }),
    );

    expect(state.profiles).toMatchObject([{ name: "Default", color: "sky" }]);
    expect(state.defaultProfileId).toBe(state.profiles[0]?.id);
    expect(state.defaultProfileId).toMatch(new RegExp(`^${profileIdPrefix}[a-z0-9]{16}$`));
    await expect(
      withService(
        home,
        Effect.gen(function* () {
          const profiles = yield* ProfileService;
          yield* profiles.delete(state.defaultProfileId);
        }),
      ),
    ).rejects.toMatchObject({
      message: "Choose another default profile before deleting this one.",
    });

    const file = JSON.parse(await readFile(join(home, ".showtime", "profiles.json"), "utf8"));
    expect(file.profiles[0].id).toBe(state.defaultProfileId);
  });

  it("creates, edits, changes default, deletes, and reloads profiles", async () => {
    const home = await mkdtemp(join(tmpdir(), "showtime-profiles-"));
    homes.push(home);

    const { created, originalDefaultId } = await withService(
      home,
      Effect.gen(function* () {
        const profiles = yield* ProfileService;
        const originalDefaultId = (yield* profiles.list).defaultProfileId;
        const profile = yield* profiles.create({ name: "  Monitor engineer  ", color: "violet" });
        yield* profiles.edit({ id: profile.id, name: "Monitors", color: "green" });
        yield* profiles.setDefault(profile.id);
        return { created: profile, originalDefaultId };
      }),
    );

    const reloaded = await withService(
      home,
      Effect.gen(function* () {
        const profiles = yield* ProfileService;
        return yield* profiles.list;
      }),
    );
    expect(reloaded.defaultProfileId).toBe(created.id);
    expect(reloaded.profiles.find((profile) => profile.id === created.id)).toMatchObject({
      name: ProfileName.make("Monitors"),
      color: "green",
    });

    await withService(
      home,
      Effect.gen(function* () {
        const profiles = yield* ProfileService;
        yield* profiles.delete(originalDefaultId);
      }),
    );
    const finalState = await withService(
      home,
      Effect.gen(function* () {
        const profiles = yield* ProfileService;
        return yield* profiles.list;
      }),
    );
    expect(finalState.profiles).toMatchObject([{ id: created.id, name: "Monitors" }]);
  });
});
