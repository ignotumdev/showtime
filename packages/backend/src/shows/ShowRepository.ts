import { Context, DateTime, Effect, Layer, PartitionedSemaphore, Ref } from "effect";
import { FileSystem } from "effect/FileSystem";
import { RpcError, type ShowFileDocument, type ShowId } from "@showtime/contracts";
import { ShowDiscovery } from "./ShowDiscovery.js";
import { ShowFile } from "./ShowFile.js";

export interface ShowDocumentEntry {
  readonly document: ShowFileDocument;
  readonly path: string;
}

interface ShowRepositoryShape {
  readonly list: Effect.Effect<ReadonlyArray<ShowDocumentEntry>, RpcError>;
  readonly findById: (id: ShowId) => Effect.Effect<ShowDocumentEntry, RpcError>;
  readonly insert: (entry: ShowDocumentEntry) => Effect.Effect<void, RpcError>;
  readonly update: (
    id: ShowId,
    update: (document: ShowFileDocument) => ShowFileDocument,
  ) => Effect.Effect<ShowDocumentEntry, RpcError>;
  readonly delete: (id: ShowId) => Effect.Effect<void, RpcError>;
}

export class ShowRepository extends Context.Service<ShowRepository, ShowRepositoryShape>()(
  "@showtime/backend/shows/ShowRepository",
) {}

const toRpcError = (message: string) => (cause: unknown) => new RpcError({ message, cause });

const make = Effect.fnUntraced(function* () {
  const discovery = yield* ShowDiscovery;
  const showFile = yield* ShowFile;
  const fs = yield* FileSystem;
  const entries = yield* discovery.discover.pipe(
    Effect.mapError(toRpcError("Could not discover shows.")),
  );
  const initialEntries = new Map<ShowId, ShowDocumentEntry>();
  for (const entry of entries) {
    const id = entry.document.config.id;
    const existing = initialEntries.get(id);
    if (existing) {
      return yield* Effect.fail(
        new RpcError({
          message: `Duplicate show ID ${id} found in ${existing.path} and ${entry.path}.`,
        }),
      );
    }
    initialEntries.set(id, entry);
  }
  const state = yield* Ref.make(initialEntries);
  const locks = yield* PartitionedSemaphore.make<ShowId>({ permits: 1 });

  const list: ShowRepositoryShape["list"] = Ref.get(state).pipe(
    Effect.map((current) => Array.from(current.values())),
  );

  const findById: ShowRepositoryShape["findById"] = Effect.fnUntraced(function* (id) {
    const found = (yield* Ref.get(state)).get(id);
    if (!found) return yield* Effect.fail(new RpcError({ message: "Show not found." }));
    return found;
  });

  const insert: ShowRepositoryShape["insert"] = (entry) =>
    Ref.update(state, (current) => {
      const next = new Map(current);
      next.set(entry.document.config.id, entry);
      return next;
    }).pipe(locks.withPermit(entry.document.config.id));

  const update: ShowRepositoryShape["update"] = (id, updateDocument) =>
    Effect.gen(function* () {
      const current = yield* findById(id);
      const next = yield* Effect.try({
        try: () => updateDocument(current.document),
        catch: toRpcError("Could not update show data."),
      });
      const now = yield* DateTime.now;
      const refreshed: ShowFileDocument = {
        ...next,
        config: { ...next.config, id, updatedAt: now },
      };
      yield* showFile
        .write(current.path, refreshed)
        .pipe(Effect.mapError(toRpcError("Could not persist show data.")));
      const entry = { path: current.path, document: refreshed };
      yield* Ref.update(state, (documents) => {
        const updated = new Map(documents);
        updated.set(id, entry);
        return updated;
      });
      return entry;
    }).pipe(locks.withPermit(id));

  const deleteShow: ShowRepositoryShape["delete"] = (id) =>
    Effect.gen(function* () {
      const current = yield* findById(id);
      yield* fs.remove(current.path).pipe(Effect.mapError(toRpcError("Could not delete show.")));
      yield* Ref.update(state, (documents) => {
        const updated = new Map(documents);
        updated.delete(id);
        return updated;
      });
    }).pipe(locks.withPermit(id));

  return ShowRepository.of({ list, findById, insert, update, delete: deleteShow });
});

export const layer = Layer.effect(ShowRepository, make());
