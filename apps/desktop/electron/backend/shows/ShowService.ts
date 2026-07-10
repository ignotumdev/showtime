import { Context, DateTime, Effect, Layer } from "effect";
import { FileSystem } from "effect/FileSystem";
import {
  decodeShowName,
  sortShowSummaries,
  RpcError,
  type ShowFileDocument,
  type ShowColor,
  type ShowId,
  type ShowSummary,
} from "@showtime/contracts";
import { Ids } from "../ids/Ids";
import { ShowFile } from "./ShowFile";
import { ShowPaths } from "./ShowPaths";
import { ShowRepository } from "./ShowRepository";

export class ShowService extends Context.Service<
  ShowService,
  {
    readonly list: Effect.Effect<ReadonlyArray<ShowSummary>, RpcError>;
    readonly create: (params: {
      readonly name: string;
      readonly color: ShowColor;
    }) => Effect.Effect<ShowSummary, RpcError>;
    readonly edit: (params: {
      readonly id: ShowId;
      readonly name: string;
      readonly color: ShowColor;
    }) => Effect.Effect<ShowSummary, RpcError>;
    readonly delete: (id: ShowId) => Effect.Effect<void, RpcError>;
  }
>()("showtime/ShowService") {}

const toRpcError = (message: string) => (cause: unknown) =>
  new RpcError({
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
  const repository = yield* ShowRepository;
  const showFile = yield* ShowFile;
  const paths = yield* ShowPaths;

  const list = repository.list.pipe(
    Effect.map((documents) =>
      sortShowSummaries(documents.map(({ document }) => toSummary(document))),
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
    const found = yield* repository.findById(id);
    const nextPath = yield* paths.makeShowFilePath({ id, name });
    const targetPath = nextPath === found.path ? found.path : nextPath;

    if (targetPath !== found.path) {
      yield* fs
        .rename(found.path, targetPath)
        .pipe(Effect.mapError(toRpcError("Could not rename show file.")));
    }

    const document = yield* showFile
      .update(targetPath, (current) => ({
        ...current,
        config: {
          ...current.config,
          name: showName,
          color,
        },
      }))
      .pipe(Effect.mapError(toRpcError("Could not edit show.")));

    return toSummary(document);
  });

  const deleteShow = Effect.fnUntraced(function* (id: ShowId) {
    const found = yield* repository.findById(id);
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
