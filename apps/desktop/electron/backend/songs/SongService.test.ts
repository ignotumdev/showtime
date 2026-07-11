import { NodeFileSystem, NodePath } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import type { SongArtist, SongName } from "@showtime/contracts";
import * as Ids from "../ids/Ids";
import * as ShowDiscovery from "../shows/ShowDiscovery";
import * as ShowFile from "../shows/ShowFile";
import * as ShowPaths from "../shows/ShowPaths";
import * as ShowRepository from "../shows/ShowRepository";
import { ShowService } from "../shows/ShowService";
import * as ShowServiceLayer from "../shows/ShowService";
import { MicrophoneService } from "../microphones/MicrophoneService";
import * as MicrophoneServiceLayer from "../microphones/MicrophoneService";
import { SongService } from "./SongService";
import * as SongServiceLayer from "./SongService";

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
  return Layer.mergeAll(
    ShowServiceLayer.layer,
    SongServiceLayer.layer,
    MicrophoneServiceLayer.layer,
  ).pipe(
    Layer.provideMerge(Layer.mergeAll(Ids.layer, repository)),
    Layer.provide(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer)),
  );
};

const songInput = (name: string) => ({
  name: name as SongName,
  artist: "Artist" as SongArtist,
});

describe("SongService", () => {
  it("creates and edits songs with blank names and artists", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "showtime-home-"));
    tempHomes.add(home);
    const song = await Effect.runPromise(
      Effect.gen(function* () {
        const shows = yield* ShowService;
        const songs = yield* SongService;
        const show = yield* shows.create({ name: "Festival", color: "sky" });
        const created = yield* songs.create({
          showId: show.id,
          name: "" as SongName,
          artist: "" as SongArtist,
        });
        return yield* songs.edit({
          showId: show.id,
          id: created.id,
          name: "" as SongName,
          artist: "" as SongArtist,
          mixAssignments: [],
          microphoneNames: [],
        });
      }).pipe(Effect.provide(makeLayer(home))),
    );

    expect(song).toMatchObject({ name: "", artist: "" });
  });

  it("creates, edits, reorders, and soft-deletes songs", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "showtime-home-"));
    tempHomes.add(home);
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const shows = yield* ShowService;
        const songs = yield* SongService;
        const microphones = yield* MicrophoneService;
        const show = yield* shows.create({ name: "Festival", color: "sky" });
        const first = yield* songs.create({ showId: show.id, ...songInput("First") });
        const second = yield* songs.create({ showId: show.id, ...songInput("Second") });
        const microphone = yield* microphones.create({ showId: show.id, color: "rose" });
        const edited = yield* songs.edit({
          showId: show.id,
          id: first.id,
          name: first.name,
          artist: first.artist,
          notes: "  Opening cue  ",
          mixAssignments: [{ mixId: "mix_main" as never, microphoneIds: [microphone.id] }],
          microphoneNames: [],
        });
        const reordered = yield* songs.reorder({
          showId: show.id,
          orderedSongIds: [second.id, first.id],
        });
        yield* songs.delete({ showId: show.id, id: second.id });
        return { first, second, edited, reordered, listed: yield* songs.list(show.id) };
      }).pipe(Effect.provide(makeLayer(home))),
    );

    expect(result.edited.notes).toBe("Opening cue");
    expect(result.edited.mixAssignments[0]?.microphoneIds).toHaveLength(1);
    expect(result.reordered.map((song) => song.name)).toEqual(["Second", "First"]);
    expect(result.listed.map((song) => song.name)).toEqual(["First"]);
    expect(result.edited.createdAt).toEqual(result.first.createdAt);
  });

  it("stores a song-specific microphone name and removes it when it matches the inherited name", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "showtime-home-"));
    tempHomes.add(home);
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const shows = yield* ShowService;
        const songs = yield* SongService;
        const microphones = yield* MicrophoneService;
        const show = yield* shows.create({ name: "Festival", color: "sky" });
        const song = yield* songs.create({ showId: show.id, ...songInput("First") });
        const createdMicrophone = yield* microphones.create({ showId: show.id, color: "rose" });
        const microphone = yield* microphones.edit({
          showId: show.id,
          id: createdMicrophone.id,
          number: createdMicrophone.number,
          color: createdMicrophone.color,
          name: "Lead",
        });
        const overridden = yield* songs.edit({
          showId: show.id,
          id: song.id,
          name: song.name,
          artist: song.artist,
          mixAssignments: [],
          microphoneNames: [{ microphoneId: microphone.id, name: "Keys" }],
        });
        const inherited = yield* songs.edit({
          showId: show.id,
          id: song.id,
          name: song.name,
          artist: song.artist,
          mixAssignments: [],
          microphoneNames: [{ microphoneId: microphone.id, name: "  Lead  " }],
        });
        return { overridden, inherited };
      }).pipe(Effect.provide(makeLayer(home))),
    );

    expect(result.overridden.microphoneNames).toEqual([
      { microphoneId: expect.any(String), name: "Keys" },
    ]);
    expect(result.inherited.microphoneNames).toBeUndefined();
  });

  it("rejects incomplete reorder payloads without changing the setlist", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "showtime-home-"));
    tempHomes.add(home);
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const shows = yield* ShowService;
        const songs = yield* SongService;
        const show = yield* shows.create({ name: "Festival", color: "sky" });
        const first = yield* songs.create({ showId: show.id, ...songInput("First") });
        yield* songs.create({ showId: show.id, ...songInput("Second") });
        const failure = yield* Effect.result(
          songs.reorder({ showId: show.id, orderedSongIds: [first.id] }),
        );
        return { failure, listed: yield* songs.list(show.id) };
      }).pipe(Effect.provide(makeLayer(home))),
    );
    expect(result.failure._tag).toBe("Failure");
    expect(result.listed.map((song) => song.name)).toEqual(["First", "Second"]);
  });
});
