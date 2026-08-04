import { Effect, Layer } from "effect";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  makeClientId,
  songIdPrefix,
  type SongArtist,
  type SongId,
  type SongName,
} from "@showtime/contracts";
import * as Ids from "../ids/Ids.js";
import * as ShowRepository from "../shows/ShowRepository.js";
import { makeDatabaseTestLayer } from "../database/DatabaseTest.js";
import { ShowService } from "../shows/ShowService.js";
import * as ShowServiceLayer from "../shows/ShowService.js";
import { MicrophoneService } from "../microphones/MicrophoneService.js";
import * as MicrophoneServiceLayer from "../microphones/MicrophoneService.js";
import { SongService } from "./SongService.js";
import * as SongServiceLayer from "./SongService.js";

const tempHomes = new Set<string>();
afterEach(async () => {
  await Promise.all(Array.from(tempHomes, (home) => rm(home, { recursive: true, force: true })));
  tempHomes.clear();
});

const makeLayer = (home: string) => {
  return Layer.mergeAll(
    ShowServiceLayer.layer,
    SongServiceLayer.layer,
    MicrophoneServiceLayer.layer,
  ).pipe(
    Layer.provideMerge(Layer.mergeAll(Ids.layer, ShowRepository.layer)),
    Layer.provide(makeDatabaseTestLayer(home)),
  );
};

const songInput = (name: string, id = makeClientId(songIdPrefix) as SongId) => ({
  id,
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
          id: makeClientId(songIdPrefix) as SongId,
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

  it("creates a song immediately after the requested song", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "showtime-home-"));
    tempHomes.add(home);
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const shows = yield* ShowService;
        const songs = yield* SongService;
        const show = yield* shows.create({ name: "Festival", color: "sky" });
        const first = yield* songs.create({ showId: show.id, ...songInput("First") });
        yield* songs.create({ showId: show.id, ...songInput("Second") });
        yield* songs.create({
          showId: show.id,
          ...songInput("Inserted"),
          insertAfterSongId: first.id,
        });
        return yield* songs.list(show.id);
      }).pipe(Effect.provide(makeLayer(home))),
    );

    expect(result.map((song) => song.name)).toEqual(["First", "Inserted", "Second"]);
  });

  it("returns the existing song when a client-generated create request is retried", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "showtime-home-"));
    tempHomes.add(home);
    const id = "song_0123456789abcdef" as SongId;
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const shows = yield* ShowService;
        const songs = yield* SongService;
        const show = yield* shows.create({ name: "Festival", color: "sky" });
        const first = yield* songs.create({ showId: show.id, ...songInput("First", id) });
        const retry = yield* songs.create({ showId: show.id, ...songInput("First", id) });
        return { first, retry, listed: yield* songs.list(show.id) };
      }).pipe(Effect.provide(makeLayer(home))),
    );

    expect(result.retry).toEqual(result.first);
    expect(result.listed).toEqual([result.first]);
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
