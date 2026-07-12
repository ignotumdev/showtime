import { Effect, Layer } from "effect";
import { RpcServer } from "effect/unstable/rpc";
import {
  microphonesSyncKey,
  mixesSyncKey,
  showsSyncKey,
  ShowtimeRpcs,
  songsSyncKey,
} from "@showtime/contracts";
import { MicrophoneService } from "../microphones/MicrophoneService.js";
import { MixService } from "../mixes/MixService.js";
import { ShowService } from "../shows/ShowService.js";
import { SongService } from "../songs/SongService.js";
import { SyncEngine } from "../sync/SyncEngine.js";

const handlers = ShowtimeRpcs.toLayer(
  Effect.gen(function* () {
    const shows = yield* ShowService;
    const microphones = yield* MicrophoneService;
    const mixes = yield* MixService;
    const songs = yield* SongService;
    const sync = yield* SyncEngine;
    return ShowtimeRpcs.of({
      "shows.list": () => sync.query(showsSyncKey, shows.list),
      "shows.create": ({ name, color }) =>
        sync.mutation(showsSyncKey, shows.create({ name, color })),
      "shows.edit": ({ id, name, color }) =>
        sync.mutation(showsSyncKey, shows.edit({ id, name, color })),
      "shows.delete": ({ id }) =>
        sync.mutation(
          [...showsSyncKey, ...microphonesSyncKey(id), ...mixesSyncKey(id), ...songsSyncKey(id)],
          shows.delete(id),
        ),
      "microphones.list": ({ showId }) =>
        sync.query(microphonesSyncKey(showId), microphones.list(showId)),
      "microphones.create": ({ showId, color }) =>
        sync.mutation(microphonesSyncKey(showId), microphones.create({ showId, color })),
      "microphones.edit": ({ showId, id, number, color, name }) =>
        sync.mutation(
          microphonesSyncKey(showId),
          microphones.edit({
            showId,
            id,
            number,
            color,
            ...(name === undefined ? {} : { name }),
          }),
        ),
      "microphones.delete": ({ showId, id }) =>
        sync.mutation(microphonesSyncKey(showId), microphones.delete({ showId, id })),
      "mixes.list": ({ showId }) => sync.query(mixesSyncKey(showId), mixes.list(showId)),
      "mixes.create": ({ showId, color }) =>
        sync.mutation(mixesSyncKey(showId), mixes.create({ showId, color })),
      "mixes.edit": ({ showId, id, number, color, name }) =>
        sync.mutation(
          mixesSyncKey(showId),
          mixes.edit({ showId, id, number, color, ...(name === undefined ? {} : { name }) }),
        ),
      "mixes.delete": ({ showId, id }) =>
        sync.mutation(mixesSyncKey(showId), mixes.delete({ showId, id })),
      "songs.list": ({ showId }) => sync.query(songsSyncKey(showId), songs.list(showId)),
      "songs.create": ({ showId, name, artist }) =>
        sync.mutation(songsSyncKey(showId), songs.create({ showId, name, artist })),
      "songs.edit": ({ showId, id, name, artist, notes, mixAssignments, microphoneNames }) =>
        sync.mutation(
          songsSyncKey(showId),
          songs.edit({
            showId,
            id,
            name,
            artist,
            mixAssignments,
            microphoneNames,
            ...(notes === undefined ? {} : { notes }),
          }),
        ),
      "songs.reorder": ({ showId, orderedSongIds }) =>
        sync.mutation(songsSyncKey(showId), songs.reorder({ showId, orderedSongIds })),
      "songs.delete": ({ showId, id }) =>
        sync.mutation(songsSyncKey(showId), songs.delete({ showId, id })),
    });
  }),
);

export const layer = RpcServer.layer(ShowtimeRpcs, { disableFatalDefects: true }).pipe(
  Layer.provide(handlers),
);
