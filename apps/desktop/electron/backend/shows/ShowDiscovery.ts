import { Context, Effect, Layer, Path } from "effect";
import { FileSystem } from "effect/FileSystem";
import { ShowDiscoveryDirectoryError, ShowDiscoveryStatError } from "@showtime/contracts";
import { ShowFile } from "./ShowFile";
import { ShowPaths } from "./ShowPaths";

export interface DiscoveredShowFile {
  readonly path: string;
}

export class ShowDiscovery extends Context.Service<
  ShowDiscovery,
  {
    readonly discover: Effect.Effect<
      ReadonlyArray<DiscoveredShowFile>,
      ShowDiscoveryDirectoryError
    >;
  }
>()("showtime/ShowDiscovery") {}

const makeShowDiscovery = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem;
  const path = yield* Path.Path;
  const paths = yield* ShowPaths;
  const showFile = yield* ShowFile;

  const discover = Effect.fnUntraced(function* () {
    const expectedDirectory = yield* paths.showsDirectory;
    const directory = yield* paths.ensureShowsDirectory.pipe(
      Effect.mapError(
        (cause) =>
          new ShowDiscoveryDirectoryError({
            path: expectedDirectory,
            cause,
          }),
      ),
    );
    const entries = yield* fs.readDirectory(directory).pipe(
      Effect.mapError(
        (cause) =>
          new ShowDiscoveryDirectoryError({
            path: directory,
            cause,
          }),
      ),
    );
    const discovered: Array<DiscoveredShowFile> = [];

    for (const entry of entries) {
      if (!paths.isShowFileName(entry)) {
        continue;
      }

      const filePath = path.join(directory, entry);
      const stat = yield* Effect.result(
        fs.stat(filePath).pipe(
          Effect.mapError(
            (cause) =>
              new ShowDiscoveryStatError({
                path: filePath,
                cause,
              }),
          ),
        ),
      );
      if (stat._tag === "Failure") {
        yield* Effect.logWarning("Skipping unstatable show file", filePath, stat.failure);
        continue;
      }

      const info = stat.success;
      if (info.type !== "File") {
        continue;
      }

      const parsed = yield* Effect.result(showFile.read(filePath));
      if (parsed._tag === "Failure") {
        yield* Effect.logWarning("Skipping invalid show file", filePath, parsed.failure);
        continue;
      }

      discovered.push({ path: filePath });
      yield* Effect.logInfo("Discovered show file", filePath);
    }

    if (discovered.length === 0) {
      yield* Effect.logInfo("No show files discovered", directory);
    }

    return discovered;
  });

  return ShowDiscovery.of({ discover: discover() });
});

export const layer = Layer.effect(ShowDiscovery, makeShowDiscovery());
