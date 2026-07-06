import { Effect, Layer } from "effect";
import { RpcServer } from "effect/unstable/rpc";
import { ShowRpcGroup } from "@showtime/contracts";
import { ShowService } from "./ShowService";

const handlers = ShowRpcGroup.toLayer(
  Effect.gen(function* () {
    const shows = yield* ShowService;

    return ShowRpcGroup.of({
      ListShows: () => shows.list,
      CreateShow: ({ name, color }) => shows.create({ name, color }),
      EditShow: ({ id, name, color }) => shows.edit({ id, name, color }),
      DeleteShow: ({ id }) => shows.delete(id),
    });
  }),
);

export const layer = RpcServer.layer(ShowRpcGroup, {
  disableFatalDefects: true,
}).pipe(Layer.provide(handlers));
