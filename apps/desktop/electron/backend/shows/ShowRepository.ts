import { Context, Effect, Layer } from "effect";
import { RpcError, type ShowFileDocument, type ShowId } from "@showtime/contracts";
import { ShowDiscovery } from "./ShowDiscovery";
import { ShowFile } from "./ShowFile";

export interface ShowDocumentEntry {
  readonly document: ShowFileDocument;
  readonly path: string;
}

interface ShowRepositoryShape {
  readonly list: Effect.Effect<ReadonlyArray<ShowDocumentEntry>, RpcError>;
  readonly findById: (id: ShowId) => Effect.Effect<ShowDocumentEntry, RpcError>;
}

export class ShowRepository extends Context.Service<ShowRepository, ShowRepositoryShape>()(
  "showtime/ShowRepository",
) {}

const toRpcError = (message: string) => (cause: unknown) => new RpcError({ message, cause });

const make = Effect.fnUntraced(function* () {
  const discovery = yield* ShowDiscovery;
  const showFile = yield* ShowFile;

  const list: ShowRepositoryShape["list"] = Effect.gen(function* () {
    const discovered = yield* discovery.discover.pipe(
      Effect.mapError(toRpcError("Could not discover shows.")),
    );
    const documents: Array<ShowDocumentEntry> = [];
    for (const file of discovered) {
      const parsed = yield* Effect.result(showFile.read(file.path));
      if (parsed._tag === "Failure") {
        yield* Effect.logWarning("Skipping unreadable show file", file.path, parsed.failure);
        continue;
      }
      documents.push({ document: parsed.success, path: file.path });
    }
    return documents;
  });

  const findById: ShowRepositoryShape["findById"] = Effect.fnUntraced(function* (id) {
    const found = (yield* list).find((entry) => entry.document.config.id === id);
    if (!found) return yield* Effect.fail(new RpcError({ message: "Show not found." }));
    return found;
  });

  return ShowRepository.of({ list, findById });
});

export const layer = Layer.effect(ShowRepository, make());
