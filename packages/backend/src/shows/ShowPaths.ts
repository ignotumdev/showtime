import { Context, Effect, Layer, Path } from "effect";
import { FileSystem } from "effect/FileSystem";
import type { PlatformError } from "effect/PlatformError";
import type { ShowId } from "@showtime/contracts";
import * as HomeDirectory from "../platform/HomeDirectory.js";

export const showFileExtension = ".showtime";

export class ShowPaths extends Context.Service<
  ShowPaths,
  {
    readonly showsDirectory: Effect.Effect<string>;
    readonly ensureShowsDirectory: Effect.Effect<string, PlatformError>;
    readonly makeShowFilePath: (params: {
      readonly name: string;
      readonly id: ShowId;
    }) => Effect.Effect<string>;
    readonly isShowFileName: (fileName: string) => boolean;
  }
>()("@showtime/backend/shows/ShowPaths") {}

export const sanitizeShowFileNamePart = (value: string) => {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return sanitized.length > 0 ? sanitized : "show";
};

const makeShowPaths = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem;
  const path = yield* Path.Path;
  const homeDirectory = yield* HomeDirectory.HomeDirectory;
  const showsDirectory = path.join(yield* homeDirectory.homeDirectory, ".showtime", "shows");

  const ensureShowsDirectory = Effect.fnUntraced(function* () {
    return yield* fs
      .makeDirectory(showsDirectory, { recursive: true })
      .pipe(Effect.as(showsDirectory));
  });

  const makeShowFilePath = ({ name, id }: { readonly name: string; readonly id: ShowId }) =>
    Effect.succeed(
      path.join(showsDirectory, `${sanitizeShowFileNamePart(name)}-${id}${showFileExtension}`),
    );

  return ShowPaths.of({
    showsDirectory: Effect.succeed(showsDirectory),
    ensureShowsDirectory: ensureShowsDirectory(),
    makeShowFilePath,
    isShowFileName: (fileName: string) => fileName.endsWith(showFileExtension),
  });
});

export const makeLayer = (homeDirectory: string) =>
  Layer.effect(ShowPaths, makeShowPaths()).pipe(
    Layer.provideMerge(HomeDirectory.makeLayer(homeDirectory)),
  );

export const layer = Layer.effect(ShowPaths, makeShowPaths());
