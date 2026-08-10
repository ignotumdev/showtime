import { NodeFileSystem } from "@effect/platform-node";
import { resolveShowtimeTheme } from "@showtime/shared";
import { Effect } from "effect";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { readAppearancePreference, writeAppearancePreference } from "./appearance-preference.js";

const temporaryDirectories: Array<string> = [];
const runFileSystem = <A, E>(effect: Effect.Effect<A, E, import("effect/FileSystem").FileSystem>) =>
  Effect.runPromise(effect.pipe(Effect.provide(NodeFileSystem.layer)));

const temporaryFile = async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "showtime-appearance-"));
  temporaryDirectories.push(directory);
  return path.join(directory, "appearance-theme");
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

describe("desktop appearance preference", () => {
  it.each(["system", "light", "dark"] as const)("persists and reads %s", async (preference) => {
    const filePath = await temporaryFile();

    await runFileSystem(writeAppearancePreference(filePath, preference));

    await expect(runFileSystem(readAppearancePreference(filePath))).resolves.toBe(preference);
  });

  it("falls back to system when the cache is missing or invalid", async () => {
    const missingFile = await temporaryFile();
    const invalidFile = await temporaryFile();
    await writeFile(invalidFile, "midnight");

    await expect(runFileSystem(readAppearancePreference(missingFile))).resolves.toBe("system");
    await expect(runFileSystem(readAppearancePreference(invalidFile))).resolves.toBe("system");
  });

  it("uses explicit preferences before falling back to the system appearance", () => {
    expect(resolveShowtimeTheme("dark", false)).toBe("dark");
    expect(resolveShowtimeTheme("light", true)).toBe("light");
    expect(resolveShowtimeTheme("system", false)).toBe("light");
    expect(resolveShowtimeTheme("system", true)).toBe("dark");
  });
});
