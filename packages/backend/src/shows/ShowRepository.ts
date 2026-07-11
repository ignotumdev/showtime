import { Context, Effect, Layer } from "effect";
import { RpcError, type ShowFileDocument, type ShowId } from "@showtime/contracts";
import { ShowDiscovery } from "./ShowDiscovery.js";

export interface ShowDocumentEntry {
  readonly document: ShowFileDocument;
  readonly path: string;
}

interface ShowRepositoryShape {
  readonly list: Effect.Effect<ReadonlyArray<ShowDocumentEntry>, RpcError>;
  readonly findById: (id: ShowId) => Effect.Effect<ShowDocumentEntry, RpcError>;
}

export class ShowRepository extends Context.Service<ShowRepository, ShowRepositoryShape>()(
  "@showtime/backend/shows/ShowRepository",
) {}

const toRpcError = (message: string) => (cause: unknown) => new RpcError({ message, cause });

const make = Effect.fnUntraced(function* () {
  const discovery = yield* ShowDiscovery;

  const list: ShowRepositoryShape["list"] = discovery.discover.pipe(
    Effect.mapError(toRpcError("Could not discover shows.")),
  );

  const findById: ShowRepositoryShape["findById"] = Effect.fnUntraced(function* (id) {
    const found = (yield* list).find((entry) => entry.document.config.id === id);
    if (!found) return yield* Effect.fail(new RpcError({ message: "Show not found." }));
    return found;
  });

  return ShowRepository.of({ list, findById });
});

export const layer = Layer.effect(ShowRepository, make());
