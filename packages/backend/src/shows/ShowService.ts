import { Context, DateTime, Effect, Layer } from "effect";
import {
  decodeShowName,
  sortShowSummaries,
  RpcError,
  type ShowFileDocument,
  type Color,
  type ShowId,
  type ShowSummary,
} from "@showtime/contracts";
import { Ids } from "../ids/Ids.js";
import { ShowFile } from "./ShowFile.js";
import { ShowRepository } from "./ShowRepository.js";

export class ShowService extends Context.Service<
  ShowService,
  {
    readonly list: Effect.Effect<ReadonlyArray<ShowSummary>, RpcError>;
    readonly create: (params: {
      readonly name: string;
      readonly color: Color;
    }) => Effect.Effect<ShowSummary, RpcError>;
    readonly edit: (params: {
      readonly id: ShowId;
      readonly name: string;
      readonly color: Color;
    }) => Effect.Effect<ShowSummary, RpcError>;
    readonly delete: (id: ShowId) => Effect.Effect<void, RpcError>;
  }
>()("@showtime/backend/shows/ShowService") {}

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
  const ids = yield* Ids;
  const repository = yield* ShowRepository;
  const showFile = yield* ShowFile;

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
    readonly color: Color;
  }) {
    const id = yield* ids.makeShowId;
    const filePath = yield* showFile
      .create({ id, name, color })
      .pipe(Effect.mapError(toRpcError("Could not create show.")));
    const document = yield* showFile
      .read(filePath)
      .pipe(Effect.mapError(toRpcError("Could not read created show.")));
    yield* repository.insert({ path: filePath, document });

    return toSummary(document);
  });

  const edit = Effect.fnUntraced(function* ({
    id,
    name,
    color,
  }: {
    readonly id: ShowId;
    readonly name: string;
    readonly color: Color;
  }) {
    const showName = yield* decodeShowName(name).pipe(
      Effect.mapError(toRpcError("Show name cannot be empty.")),
    );
    const { document } = yield* repository
      .update(id, (current) => ({
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
    yield* repository.delete(id);
  });

  return ShowService.of({
    list,
    create,
    edit,
    delete: deleteShow,
  });
});

export const layer = Layer.effect(ShowService, makeShowService());
