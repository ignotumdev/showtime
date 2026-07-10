import { Effect, Layer } from "effect";
import { RpcServer } from "effect/unstable/rpc";
import { RpcGroup } from "@showtime/contracts";
import { MicrophoneService } from "../microphones/MicrophoneService";
import { ShowService } from "../shows/ShowService";

const handlers = RpcGroup.toLayer(
  Effect.gen(function* () {
    const shows = yield* ShowService;
    const microphones = yield* MicrophoneService;
    return RpcGroup.of({
      ListShows: () => shows.list,
      CreateShow: ({ name, color }) => shows.create({ name, color }),
      EditShow: ({ id, name, color }) => shows.edit({ id, name, color }),
      DeleteShow: ({ id }) => shows.delete(id),
      ListMicrophones: ({ showId }) => microphones.list(showId),
      CreateMicrophone: ({ showId, color }) => microphones.create({ showId, color }),
      EditMicrophone: ({ showId, id, number, color, name }) =>
        microphones.edit({
          showId,
          id,
          number,
          color,
          ...(name === undefined ? {} : { name }),
        }),
      DeleteMicrophone: ({ showId, id }) => microphones.delete({ showId, id }),
    });
  }),
);

export const layer = RpcServer.layer(RpcGroup, { disableFatalDefects: true }).pipe(
  Layer.provide(handlers),
);
