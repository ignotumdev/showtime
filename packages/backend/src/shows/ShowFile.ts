import { Context, DateTime, Effect, Layer, PartitionedSemaphore, Path, Random } from "effect";
import { FileSystem } from "effect/FileSystem";
import {
  decodeShowFileDocument,
  decodeShowName,
  encodeShowFileDocument,
  ShowFileJsonError,
  ShowFileReadError,
  ShowFileSchemaError,
  ShowFileUpdateError,
  ShowFileWriteError,
  type ShowFileError,
  type ShowFileDocument,
  type Color,
  type ShowId,
  mainMixId,
  MixId,
  MixNumber,
} from "@showtime/contracts";
import { ShowPaths } from "./ShowPaths.js";

interface ShowFileShape {
  readonly read: (filePath: string) => Effect.Effect<ShowFileDocument, ShowFileError>;
  readonly write: (
    filePath: string,
    document: ShowFileDocument,
  ) => Effect.Effect<void, ShowFileError>;
  readonly create: (params: {
    readonly id: ShowId;
    readonly name: string;
    readonly color: Color;
  }) => Effect.Effect<string, ShowFileError>;
  readonly update: (
    filePath: string,
    update: (document: ShowFileDocument) => ShowFileDocument,
  ) => Effect.Effect<ShowFileDocument, ShowFileError>;
}

export class ShowFile extends Context.Service<ShowFile, ShowFileShape>()(
  "@showtime/backend/shows/ShowFile",
) {}

const stableJson = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

const makeShowFile = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem;
  const path = yield* Path.Path;
  const paths = yield* ShowPaths;
  const updateSemaphore = yield* PartitionedSemaphore.make<string>({ permits: 1 });

  const read: ShowFileShape["read"] = Effect.fnUntraced(function* (filePath) {
    const content = yield* fs
      .readFileString(filePath)
      .pipe(Effect.mapError((cause) => new ShowFileReadError({ path: filePath, cause })));
    const json = yield* Effect.try({
      try: () => JSON.parse(content) as unknown,
      catch: (cause) => new ShowFileJsonError({ path: filePath, cause }),
    });

    return yield* decodeShowFileDocument(json).pipe(
      Effect.mapError((cause) => new ShowFileSchemaError({ path: filePath, cause })),
    );
  });

  const writeAtomic = Effect.fnUntraced(function* (filePath: string, content: string) {
    const directory = path.dirname(filePath);
    const suffix = yield* Random.nextIntBetween(0, Number.MAX_SAFE_INTEGER);
    const tempPath = path.join(directory, `.${path.basename(filePath)}.${suffix.toString(36)}.tmp`);

    yield* fs
      .writeFileString(tempPath, content)
      .pipe(
        Effect.andThen(fs.rename(tempPath, filePath)),
        Effect.ensuring(fs.remove(tempPath).pipe(Effect.ignore)),
      );
  });

  const write: ShowFileShape["write"] = Effect.fnUntraced(function* (filePath, document) {
    const content = yield* encodeShowFileDocument(document).pipe(
      Effect.mapError((cause) => new ShowFileSchemaError({ path: filePath, cause })),
      Effect.map(stableJson),
    );

    yield* writeAtomic(filePath, content).pipe(
      Effect.mapError((cause) => new ShowFileWriteError({ path: filePath, cause })),
    );
  });

  const create: ShowFileShape["create"] = Effect.fnUntraced(function* ({ id, name, color }) {
    const now = yield* DateTime.now;
    const filePath = yield* paths.makeShowFilePath({ name, id });
    const showName = yield* decodeShowName(name).pipe(
      Effect.mapError((cause) => new ShowFileSchemaError({ path: filePath, cause })),
    );

    yield* paths.ensureShowsDirectory.pipe(
      Effect.mapError((cause) => new ShowFileWriteError({ path: filePath, cause })),
    );
    yield* write(filePath, {
      type: "showtime-show",
      version: "dev",
      config: {
        id,
        name: showName,
        color,
        createdAt: now,
        updatedAt: now,
      },
      microphones: [],
      mixes: [
        {
          id: MixId.make(mainMixId),
          number: MixNumber.make("LR"),
          color: "sky",
          name: "Main",
          createdAt: now,
          updatedAt: now,
        },
      ],
      songs: [],
    });
    return filePath;
  });

  const update: ShowFileShape["update"] = (filePath, updateDocument) =>
    Effect.gen(function* () {
      const document = yield* read(filePath);
      const next = yield* Effect.try({
        try: () => updateDocument(document),
        catch: (cause) => new ShowFileUpdateError({ path: filePath, cause }),
      });
      const now = yield* DateTime.now;
      const refreshed = {
        ...next,
        config: {
          ...next.config,
          updatedAt: now,
        },
      };

      yield* write(filePath, refreshed);
      return refreshed;
    }).pipe(updateSemaphore.withPermit(filePath));

  return ShowFile.of({ read, write, create, update });
});

export const layer = Layer.effect(ShowFile, makeShowFile());
