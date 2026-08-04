import { Context, DateTime, Effect, Layer, Option } from "effect";
import {
  decodeSongArtist,
  decodeSongName,
  insertSongAfter,
  RpcError,
  type ShowId,
  type Song,
  type SongArtist,
  type SongId,
  type SongMixName,
  type SongMicrophoneName,
  type SongMixAssignment,
  type SongName,
} from "@showtime/contracts";
import { ShowRepository } from "../shows/ShowRepository.js";

interface SongServiceShape {
  readonly list: (showId: ShowId) => Effect.Effect<ReadonlyArray<Song>, RpcError>;
  readonly create: (params: {
    readonly showId: ShowId;
    readonly id: SongId;
    readonly name: SongName;
    readonly artist: SongArtist;
    readonly insertAfterSongId?: SongId;
  }) => Effect.Effect<Song, RpcError>;
  readonly edit: (params: {
    readonly showId: ShowId;
    readonly id: SongId;
    readonly name: SongName;
    readonly artist: SongArtist;
    readonly notes?: string;
    readonly mixAssignments: ReadonlyArray<SongMixAssignment>;
    readonly microphoneNames: ReadonlyArray<SongMicrophoneName>;
    readonly mixNames: ReadonlyArray<SongMixName>;
  }) => Effect.Effect<Song, RpcError>;
  readonly reorder: (params: {
    readonly showId: ShowId;
    readonly orderedSongIds: ReadonlyArray<SongId>;
  }) => Effect.Effect<ReadonlyArray<Song>, RpcError>;
  readonly delete: (params: {
    readonly showId: ShowId;
    readonly id: SongId;
  }) => Effect.Effect<void, RpcError>;
}

export class SongService extends Context.Service<SongService, SongServiceShape>()(
  "@showtime/backend/songs/SongService",
) {}

const toRpcError = (message: string) => (cause: unknown) => new RpcError({ message, cause });

const make = Effect.fnUntraced(function* () {
  const repository = yield* ShowRepository;

  const list: SongServiceShape["list"] = Effect.fnUntraced(function* (showId) {
    return (yield* repository.findById(showId)).songs.filter(
      (song) => song.deletedAt === undefined,
    );
  });

  const create: SongServiceShape["create"] = Effect.fnUntraced(function* (params) {
    const id = params.id;
    const name = yield* decodeSongName(params.name.trim()).pipe(
      Effect.mapError(toRpcError("Invalid song name.")),
    );
    const artist = yield* decodeSongArtist(params.artist.trim()).pipe(
      Effect.mapError(toRpcError("Invalid song artist.")),
    );
    const now = yield* DateTime.now;
    const song: Song = {
      id,
      name,
      artist,
      mixAssignments: [],
      createdAt: now,
      updatedAt: now,
    };
    const updated = yield* repository
      .update(params.showId, (document) => {
        // The client owns the ID for new create requests. If a response is lost
        // and the RPC is retried after persistence, return the original song
        // instead of inserting a duplicate.
        if (document.songs.some((item) => item.id === id && item.deletedAt === undefined)) {
          return document;
        }
        if (
          params.insertAfterSongId !== undefined &&
          !document.songs.some(
            (item) => item.id === params.insertAfterSongId && item.deletedAt === undefined,
          )
        ) {
          throw new Error("The song to insert after no longer exists.");
        }
        const songs = insertSongAfter(document.songs, song, params.insertAfterSongId);
        if (Option.isNone(songs)) throw new Error("The song to insert after no longer exists.");
        return { ...document, songs: songs.value };
      })
      .pipe(Effect.mapError(toRpcError("Could not add song.")));
    return updated.songs.find((item) => item.id === id && item.deletedAt === undefined)!;
  });

  const edit: SongServiceShape["edit"] = Effect.fnUntraced(function* (params) {
    const found = yield* repository.findById(params.showId);
    const existing = found.songs.find(
      (song) => song.id === params.id && song.deletedAt === undefined,
    );
    if (!existing) return yield* Effect.fail(new RpcError({ message: "Song not found." }));

    const activeMixIds = new Set(
      found.mixes.filter((mix) => mix.deletedAt === undefined).map((mix) => mix.id),
    );
    const activeMicrophones = found.microphones.filter(
      (microphone) => microphone.deletedAt === undefined,
    );
    const activeMicrophoneIds = new Set(activeMicrophones.map((microphone) => microphone.id));
    const seenMixIds = new Set<string>();
    for (const assignment of params.mixAssignments) {
      if (!activeMixIds.has(assignment.mixId)) {
        return yield* Effect.fail(new RpcError({ message: "A selected mix no longer exists." }));
      }
      if (seenMixIds.has(assignment.mixId)) {
        return yield* Effect.fail(new RpcError({ message: "A mix was assigned more than once." }));
      }
      seenMixIds.add(assignment.mixId);
      if (
        new Set(assignment.microphoneIds).size !== assignment.microphoneIds.length ||
        assignment.microphoneIds.some((id) => !activeMicrophoneIds.has(id))
      ) {
        return yield* Effect.fail(
          new RpcError({ message: "A selected microphone is invalid or no longer exists." }),
        );
      }
    }
    if (
      new Set(params.microphoneNames.map((item) => item.microphoneId)).size !==
        params.microphoneNames.length ||
      params.microphoneNames.some((item) => !activeMicrophoneIds.has(item.microphoneId))
    ) {
      return yield* Effect.fail(
        new RpcError({ message: "A named microphone is invalid or no longer exists." }),
      );
    }
    if (new Set(params.mixNames.map((item) => item.mixId)).size !== params.mixNames.length) {
      return yield* Effect.fail(new RpcError({ message: "A mix was named more than once." }));
    }
    if (params.mixNames.some((item) => !activeMixIds.has(item.mixId))) {
      return yield* Effect.fail(new RpcError({ message: "A named mix no longer exists." }));
    }

    const requestedByMix = new Map(params.mixAssignments.map((item) => [item.mixId, item]));
    const mixAssignments: Array<SongMixAssignment> = found.mixes
      .filter((mix) => mix.deletedAt === undefined)
      .flatMap((mix) => {
        const requested = requestedByMix.get(mix.id);
        if (!requested) return [];
        const selected = new Set(requested.microphoneIds);
        const microphoneIds = activeMicrophones
          .filter((microphone) => selected.has(microphone.id))
          .map((microphone) => microphone.id);
        return microphoneIds.length > 0 ? [{ mixId: mix.id, microphoneIds }] : [];
      });
    const microphoneNames = activeMicrophones.flatMap((microphone) => {
      const requestedName = params.microphoneNames
        .find((item) => item.microphoneId === microphone.id)
        ?.name.trim();
      const inheritedName = microphone.name?.trim() ?? "";
      return requestedName && requestedName !== inheritedName
        ? [{ microphoneId: microphone.id, name: requestedName }]
        : [];
    });
    const mixNames = found.mixes
      .filter((mix) => mix.deletedAt === undefined)
      .flatMap((mix) => {
        const requestedName = params.mixNames.find((item) => item.mixId === mix.id)?.name.trim();
        const inheritedName = mix.name?.trim() ?? "";
        return requestedName && requestedName !== inheritedName
          ? [{ mixId: mix.id, name: requestedName }]
          : [];
      });
    const name = yield* decodeSongName(params.name.trim()).pipe(
      Effect.mapError(toRpcError("Invalid song name.")),
    );
    const artist = yield* decodeSongArtist(params.artist.trim()).pipe(
      Effect.mapError(toRpcError("Invalid song artist.")),
    );
    const notes = params.notes?.trim();
    const now = yield* DateTime.now;
    const updated = yield* repository
      .update(params.showId, (document) => {
        const current = document.songs.find(
          (item) => item.id === params.id && item.deletedAt === undefined,
        );
        if (!current) throw new Error("Song not found.");

        const currentMixIds = new Set(
          document.mixes.filter((mix) => mix.deletedAt === undefined).map((mix) => mix.id),
        );
        const currentMicrophoneIds = new Set(
          document.microphones
            .filter((microphone) => microphone.deletedAt === undefined)
            .map((microphone) => microphone.id),
        );
        if (
          mixAssignments.some(
            (assignment) =>
              !currentMixIds.has(assignment.mixId) ||
              assignment.microphoneIds.some((id) => !currentMicrophoneIds.has(id)),
          ) ||
          microphoneNames.some((item) => !currentMicrophoneIds.has(item.microphoneId)) ||
          mixNames.some((item) => !currentMixIds.has(item.mixId))
        ) {
          throw new Error("A referenced mix or microphone no longer exists.");
        }

        const song: Song = {
          id: current.id,
          name,
          artist,
          mixAssignments,
          ...(microphoneNames.length ? { microphoneNames } : {}),
          ...(mixNames.length ? { mixNames } : {}),
          createdAt: current.createdAt,
          updatedAt: now,
          ...(notes ? { notes } : {}),
        };
        return {
          ...document,
          songs: document.songs.map((item) => (item.id === params.id ? song : item)),
        };
      })
      .pipe(Effect.mapError(toRpcError("Could not save song.")));
    return updated.songs.find((item) => item.id === params.id)!;
  });

  const reorder: SongServiceShape["reorder"] = Effect.fnUntraced(function* (params) {
    const requested = params.orderedSongIds;
    const updated = yield* repository
      .update(params.showId, (document) => {
        const active = document.songs.filter((song) => song.deletedAt === undefined);
        if (
          requested.length !== active.length ||
          new Set(requested).size !== requested.length ||
          requested.some((id) => !active.some((song) => song.id === id))
        ) {
          throw new Error("The active setlist changed while it was being reordered.");
        }
        const byId = new Map(active.map((song) => [song.id, song]));
        const ordered = requested.map((id) => byId.get(id)!);
        let activeIndex = 0;
        return {
          ...document,
          songs: document.songs.map((song) =>
            song.deletedAt === undefined ? ordered[activeIndex++]! : song,
          ),
        };
      })
      .pipe(Effect.mapError(toRpcError("Could not reorder songs.")));
    return updated.songs.filter((song) => song.deletedAt === undefined);
  });

  const deleteSong: SongServiceShape["delete"] = Effect.fnUntraced(function* (params) {
    const found = yield* repository.findById(params.showId);
    if (!found.songs.some((song) => song.id === params.id && !song.deletedAt)) {
      return yield* Effect.fail(new RpcError({ message: "Song not found." }));
    }
    const now = yield* DateTime.now;
    yield* repository
      .update(params.showId, (document) => ({
        ...document,
        songs: document.songs.map((song) =>
          song.id === params.id ? { ...song, updatedAt: now, deletedAt: now } : song,
        ),
      }))
      .pipe(Effect.mapError(toRpcError("Could not delete song.")));
  });

  return SongService.of({ list, create, edit, reorder, delete: deleteSong });
});

export const layer = Layer.effect(SongService, make());
