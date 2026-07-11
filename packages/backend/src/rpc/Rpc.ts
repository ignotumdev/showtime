import { Effect, Layer } from "effect";
import { RpcServer } from "effect/unstable/rpc";
import { ShowtimeRpcs } from "@showtime/contracts";
import { MicrophoneService } from "../microphones/MicrophoneService.js";
import { MixService } from "../mixes/MixService.js";
import { ShowService } from "../shows/ShowService.js";
import { SongService } from "../songs/SongService.js";

const handlers = ShowtimeRpcs.toLayer(
  Effect.gen(function* () {
    const shows = yield* ShowService;
    const microphones = yield* MicrophoneService;
    const mixes = yield* MixService;
    const songs = yield* SongService;
    return ShowtimeRpcs.of({
      "shows.list": () => shows.list,
      "shows.create": ({ name, color }) => shows.create({ name, color }),
      "shows.edit": ({ id, name, color }) => shows.edit({ id, name, color }),
      "shows.delete": ({ id }) => shows.delete(id),
      "microphones.list": ({ showId }) => microphones.list(showId),
      "microphones.create": ({ showId, color }) => microphones.create({ showId, color }),
      "microphones.edit": ({ showId, id, number, color, name }) =>
        microphones.edit({
          showId,
          id,
          number,
          color,
          ...(name === undefined ? {} : { name }),
        }),
      "microphones.delete": ({ showId, id }) => microphones.delete({ showId, id }),
      "mixes.list": ({ showId }) => mixes.list(showId),
      "mixes.create": ({ showId, color }) => mixes.create({ showId, color }),
      "mixes.edit": ({ showId, id, number, color, name }) =>
        mixes.edit({ showId, id, number, color, ...(name === undefined ? {} : { name }) }),
      "mixes.delete": ({ showId, id }) => mixes.delete({ showId, id }),
      "songs.list": ({ showId }) => songs.list(showId),
      "songs.create": ({ showId, name, artist }) => songs.create({ showId, name, artist }),
      "songs.edit": ({ showId, id, name, artist, notes, mixAssignments, microphoneNames }) =>
        songs.edit({
          showId,
          id,
          name,
          artist,
          mixAssignments,
          microphoneNames,
          ...(notes === undefined ? {} : { notes }),
        }),
      "songs.reorder": ({ showId, orderedSongIds }) => songs.reorder({ showId, orderedSongIds }),
      "songs.delete": ({ showId, id }) => songs.delete({ showId, id }),
    });
  }),
);

export const layer = RpcServer.layer(ShowtimeRpcs, { disableFatalDefects: true }).pipe(
  Layer.provide(handlers),
);
