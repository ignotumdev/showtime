import { Effect, Layer } from "effect";
import { RpcServer } from "effect/unstable/rpc";
import { ShowRpcGroup } from "@showtime/contracts";
import { ShowService } from "./ShowService";

const handlers = ShowRpcGroup.toLayer(
  Effect.gen(function* () {
    const shows = yield* ShowService;

    return ShowRpcGroup.of({
      ListShows: () => shows.list,
      CreateShow: ({ name }) => shows.create(name),
      RenameShow: ({ id, name }) => shows.rename({ id, name }),
      DeleteShow: ({ id }) => shows.delete(id),
    });
  }),
);

export const layer = RpcServer.layer(ShowRpcGroup, {
  disableFatalDefects: true,
}).pipe(Layer.provide(handlers));
