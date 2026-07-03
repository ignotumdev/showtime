import { Context, DateTime, Effect, Layer } from "effect";
import { FileSystem } from "effect/FileSystem";
import {
  decodeShowName,
  ShowRpcError,
  type ShowFileDocument,
  type ShowColor,
  type ShowId,
  type ShowSummary,
} from "@showtime/contracts";
import { Ids } from "../ids/Ids";
import { ShowDiscovery } from "./ShowDiscovery";
import { ShowFile } from "./ShowFile";
import { ShowPaths } from "./ShowPaths";

export class ShowService extends Context.Service<
  ShowService,
  {
    readonly list: Effect.Effect<ReadonlyArray<ShowSummary>, ShowRpcError>;
    readonly create: (params: {
      readonly name: string;
      readonly color: ShowColor;
    }) => Effect.Effect<ShowSummary, ShowRpcError>;
    readonly edit: (params: {
      readonly id: ShowId;
      readonly name: string;
      readonly color: ShowColor;
    }) => Effect.Effect<ShowSummary, ShowRpcError>;
    readonly delete: (id: ShowId) => Effect.Effect<void, ShowRpcError>;
  }
>()("showtime/ShowService") {}

const toRpcError = (message: string) => (cause: unknown) =>
  new ShowRpcError({
    message,
    cause,
  });

const toSummary = (document: ShowFileDocument): ShowSummary => ({
  id: document.config.id,
  name: document.config.name,
  color: document.config.color,
  createdAt: DateTime.formatIso(document.config.createdAt),
  updatedAt: DateTime.formatIso(document.config.updatedAt),
});

const makeShowService = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem;
  const ids = yield* Ids;
  const discovery = yield* ShowDiscovery;
  const showFile = yield* ShowFile;
  const paths = yield* ShowPaths;

  const listDocuments = Effect.fnUntraced(function* () {
    const discovered = yield* discovery.discover.pipe(
      Effect.mapError(toRpcError("Could not discover shows.")),
    );
    const documents = [];

    for (const file of discovered) {
      const document = yield* showFile
        .read(file.path)
        .pipe(Effect.mapError(toRpcError("Could not read show file.")));
      documents.push({ document, path: file.path });
    }

    return documents;
  });

  const findById = Effect.fnUntraced(function* (id: ShowId) {
    const documents = yield* listDocuments();
    const found = documents.find((entry) => entry.document.config.id === id);

    if (!found) {
      return yield* Effect.fail(new ShowRpcError({ message: "Show not found." }));
    }

    return found;
  });

  const list = listDocuments().pipe(
    Effect.map((documents) =>
      documents
        .map(({ document }) => toSummary(document))
        .sort((left, right) =>
          `${left.name.toLocaleLowerCase()}:${left.id}`.localeCompare(
            `${right.name.toLocaleLowerCase()}:${right.id}`,
          ),
        ),
    ),
    Effect.mapError(toRpcError("Could not list shows.")),
  );

  const create = Effect.fnUntraced(function* ({
    name,
    color,
  }: {
    readonly name: string;
    readonly color: ShowColor;
  }) {
    const id = yield* ids.makeShowId;
    const filePath = yield* showFile
      .create({ id, name, color })
      .pipe(Effect.mapError(toRpcError("Could not create show.")));
    const document = yield* showFile
      .read(filePath)
      .pipe(Effect.mapError(toRpcError("Could not read created show.")));

    return toSummary(document);
  });

  const edit = Effect.fnUntraced(function* ({
    id,
    name,
    color,
  }: {
    readonly id: ShowId;
    readonly name: string;
    readonly color: ShowColor;
  }) {
    const showName = yield* decodeShowName(name).pipe(
      Effect.mapError(toRpcError("Show name cannot be empty.")),
    );
    const found = yield* findById(id);
    const nextPath = yield* paths.makeShowFilePath({ id, name });
    const document = yield* showFile
      .update(found.path, (current) => ({
        ...current,
        config: {
          ...current.config,
          name: showName,
          color,
        },
      }))
      .pipe(Effect.mapError(toRpcError("Could not edit show.")));

    if (nextPath !== found.path) {
      yield* fs
        .rename(found.path, nextPath)
        .pipe(Effect.mapError(toRpcError("Could not rename show file.")));
    }

    return toSummary(document);
  });

  const deleteShow = Effect.fnUntraced(function* (id: ShowId) {
    const found = yield* findById(id);
    yield* fs.remove(found.path).pipe(Effect.mapError(toRpcError("Could not delete show.")));
  });

  return ShowService.of({
    list,
    create,
    edit,
    delete: deleteShow,
  });
});

export const layer = Layer.effect(ShowService, makeShowService());
