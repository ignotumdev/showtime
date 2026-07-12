import { Context, Effect, Layer, Path, Ref, Schema, Semaphore } from "effect";
import { FileSystem } from "effect/FileSystem";
import * as HomeDirectory from "../platform/HomeDirectory.js";
import { isNotFound, readJson, writeJsonAtomic } from "../persistence/JsonFile.js";

const SettingsFile = Schema.Struct({
  version: Schema.Literal(1),
  connectionsEnabled: Schema.Boolean,
});

export type ShowtimeSettings = typeof SettingsFile.Type;

export class Settings extends Context.Service<
  Settings,
  {
    readonly get: Effect.Effect<ShowtimeSettings>;
    readonly setConnectionsEnabled: (enabled: boolean) => Effect.Effect<ShowtimeSettings>;
  }
>()("@showtime/backend/settings/Settings") {}

const make = Effect.gen(function* () {
  const fs = yield* FileSystem;
  const path = yield* Path.Path;
  const home = yield* HomeDirectory.HomeDirectory;
  const directory = path.join(yield* home.homeDirectory, ".showtime");
  const filePath = path.join(directory, "settings.json");
  const initial = yield* readJson(fs, filePath, SettingsFile).pipe(
    Effect.catchIf(isNotFound, () =>
      Effect.succeed({ version: 1 as const, connectionsEnabled: true }),
    ),
    Effect.orDie,
  );
  const state = yield* Ref.make(initial);
  const lock = yield* Semaphore.make(1);
  return Settings.of({
    get: Ref.get(state),
    setConnectionsEnabled: (connectionsEnabled) =>
      lock.withPermits(1)(
        Effect.gen(function* () {
          const next = { version: 1 as const, connectionsEnabled };
          yield* writeJsonAtomic(fs, directory, filePath, next).pipe(Effect.orDie);
          yield* Ref.set(state, next);
          return next;
        }),
      ),
  });
});

export const layer = Layer.effect(Settings, make);
