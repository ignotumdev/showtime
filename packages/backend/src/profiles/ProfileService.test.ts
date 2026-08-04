import { ProfileName, profileIdPrefix } from "@showtime/contracts";
import { DateTime, Effect, Layer } from "effect";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import * as Ids from "../ids/Ids.js";
import { makeDatabaseTestLayer } from "../database/DatabaseTest.js";
import { ProfileService, layer } from "./ProfileService.js";

const homes: Array<string> = [];

const withService = async <A>(home: string, effect: Effect.Effect<A, unknown, ProfileService>) =>
  Effect.runPromise(
    effect.pipe(
      Effect.provide(
        layer.pipe(Layer.provide(Ids.layer), Layer.provide(makeDatabaseTestLayer(home))),
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
    expect(DateTime.isDateTime(state.profiles[0]?.createdAt)).toBe(true);
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

    expect((await stat(join(home, ".showtime", "showtime.db"))).isFile()).toBe(true);
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

  it("reports only unique-name violations as validation errors", async () => {
    const home = await mkdtemp(join(tmpdir(), "showtime-profiles-"));
    homes.push(home);

    await withService(
      home,
      Effect.gen(function* () {
        const profiles = yield* ProfileService;
        yield* profiles.create({ name: "Monitor engineer", color: "violet" });
      }),
    );

    await expect(
      withService(
        home,
        Effect.gen(function* () {
          const profiles = yield* ProfileService;
          yield* profiles.create({ name: "MONITOR ENGINEER", color: "green" });
        }),
      ),
    ).rejects.toMatchObject({
      message: "Could not create profile. Profile names must be unique.",
    });

    const database = new DatabaseSync(join(home, ".showtime", "showtime.db"));
    database.exec(`CREATE TRIGGER reject_profile_insert
      BEFORE INSERT ON profiles BEGIN
        SELECT RAISE(ABORT, 'synthetic persistence failure');
      END`);
    database.close();

    await expect(
      withService(
        home,
        Effect.gen(function* () {
          const profiles = yield* ProfileService;
          yield* profiles.create({ name: "Front of house", color: "sky" });
        }),
      ),
    ).rejects.toMatchObject({ message: "Could not create profile." });
  });
});
