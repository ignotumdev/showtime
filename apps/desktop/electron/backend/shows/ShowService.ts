import { Context, DateTime, Effect, Layer } from "effect";
import { FileSystem } from "effect/FileSystem";
import {
  decodeShowName,
  sortShowSummaries,
  ShowRpcError,
  type ShowFileDocument,
  type ShowColor,
  type ShowId,
  type ShowSummary,
  type Microphone,
  type MicrophoneId,
  type MicrophoneNumber,
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
    readonly listMicrophones: (
      showId: ShowId,
    ) => Effect.Effect<ReadonlyArray<Microphone>, ShowRpcError>;
    readonly createMicrophone: (params: {
      readonly showId: ShowId;
      readonly color: ShowColor;
    }) => Effect.Effect<Microphone, ShowRpcError>;
    readonly editMicrophone: (params: {
      readonly showId: ShowId;
      readonly id: MicrophoneId;
      readonly number: MicrophoneNumber;
      readonly color: ShowColor;
      readonly name?: string;
    }) => Effect.Effect<Microphone, ShowRpcError>;
    readonly deleteMicrophone: (params: {
      readonly showId: ShowId;
      readonly id: MicrophoneId;
    }) => Effect.Effect<void, ShowRpcError>;
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
      const parsed = yield* Effect.result(showFile.read(file.path));

      if (parsed._tag === "Failure") {
        yield* Effect.logWarning("Skipping unreadable show file", file.path, parsed.failure);
        continue;
      }

      documents.push({ document: parsed.success, path: file.path });
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
    const found = yield* findById(id);
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
    const found = yield* findById(id);
    yield* fs.remove(found.path).pipe(Effect.mapError(toRpcError("Could not delete show.")));
  });

  const listMicrophones = Effect.fnUntraced(function* (showId: ShowId) {
    const found = yield* findById(showId);
    return found.document.microphones;
  });

  const createMicrophone = Effect.fnUntraced(function* ({
    showId,
    color,
  }: {
    readonly showId: ShowId;
    readonly color: ShowColor;
  }) {
    const found = yield* findById(showId);
    const id = yield* ids.makeMicrophoneId;
    const number = Math.max(0, ...found.document.microphones.map((mic) => mic.number)) + 1;
    const microphone: Microphone = { id, number, color };
    yield* showFile
      .update(found.path, (document) => ({
        ...document,
        microphones: [...document.microphones, microphone],
      }))
      .pipe(Effect.mapError(toRpcError("Could not add microphone.")));
    return microphone;
  });

  const editMicrophone = Effect.fnUntraced(function* (params: {
    readonly showId: ShowId;
    readonly id: MicrophoneId;
    readonly number: MicrophoneNumber;
    readonly color: ShowColor;
    readonly name?: string;
  }) {
    const found = yield* findById(params.showId);
    const current = found.document.microphones.find((mic) => mic.id === params.id);
    if (!current) {
      return yield* Effect.fail(new ShowRpcError({ message: "Microphone not found." }));
    }
    const trimmedName = params.name?.trim();
    const microphone: Microphone = {
      id: params.id,
      number: params.number,
      color: params.color,
      ...(trimmedName ? { name: trimmedName } : {}),
    };
    yield* showFile
      .update(found.path, (document) => ({
        ...document,
        microphones: document.microphones.map((mic) => (mic.id === params.id ? microphone : mic)),
      }))
      .pipe(Effect.mapError(toRpcError("Could not edit microphone.")));
    return microphone;
  });

  const deleteMicrophone = Effect.fnUntraced(function* (params: {
    readonly showId: ShowId;
    readonly id: MicrophoneId;
  }) {
    const found = yield* findById(params.showId);
    if (!found.document.microphones.some((mic) => mic.id === params.id)) {
      return yield* Effect.fail(new ShowRpcError({ message: "Microphone not found." }));
    }
    yield* showFile
      .update(found.path, (document) => ({
        ...document,
        microphones: document.microphones.filter((mic) => mic.id !== params.id),
      }))
      .pipe(Effect.mapError(toRpcError("Could not delete microphone.")));
  });

  return ShowService.of({
    list,
    create,
    edit,
    delete: deleteShow,
    listMicrophones,
    createMicrophone,
    editMicrophone,
    deleteMicrophone,
  });
});

export const layer = Layer.effect(ShowService, makeShowService());
