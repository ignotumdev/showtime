import { Context, Effect, Layer, Path, Ref, Schema, Semaphore } from "effect";
import { FileSystem } from "effect/FileSystem";
import { hostname } from "node:os";
import { normalizeShowtimeHostName, ShowtimeHostName } from "@showtime/shared";
import * as HomeDirectory from "../platform/HomeDirectory.js";
import { isNotFound, readJson, writeJsonAtomic } from "../persistence/JsonFile.js";

const LegacySettingsFile = Schema.Struct({
  version: Schema.Literal(1),
  connectionsEnabled: Schema.Boolean,
});

const SettingsFile = Schema.Struct({
  version: Schema.Literal(2),
  connectionsEnabled: Schema.Boolean,
  hostName: ShowtimeHostName,
});

const ReadableSettingsFile = Schema.Union([LegacySettingsFile, SettingsFile]);

export type ShowtimeSettings = typeof SettingsFile.Type;

export class Settings extends Context.Service<
  Settings,
  {
    readonly get: Effect.Effect<ShowtimeSettings>;
    readonly setConnectionsEnabled: (enabled: boolean) => Effect.Effect<ShowtimeSettings>;
    readonly setHostName: (hostName: ShowtimeHostName) => Effect.Effect<ShowtimeSettings>;
  }
>()("@showtime/backend/settings/Settings") {}

const make = Effect.gen(function* () {
  const fs = yield* FileSystem;
  const path = yield* Path.Path;
  const home = yield* HomeDirectory.HomeDirectory;
  const directory = path.join(yield* home.homeDirectory, ".showtime");
  const filePath = path.join(directory, "settings.json");
  const defaultHostName = normalizeShowtimeHostName(hostname());
  const loaded = yield* readJson(fs, filePath, ReadableSettingsFile).pipe(
    Effect.map((value) => ({ value, mustPersist: value.version === 1 })),
    Effect.catchIf(isNotFound, () =>
      Effect.succeed({
        value: { version: 1 as const, connectionsEnabled: true },
        mustPersist: true,
      }),
    ),
    Effect.orDie,
  );
  const initial: ShowtimeSettings = {
    version: 2,
    connectionsEnabled: loaded.value.connectionsEnabled,
    hostName: loaded.value.version === 2 ? loaded.value.hostName : defaultHostName,
  };
  if (loaded.mustPersist) {
    yield* writeJsonAtomic(fs, directory, filePath, initial).pipe(Effect.orDie);
  }

  const state = yield* Ref.make(initial);
  const lock = yield* Semaphore.make(1);
  const update = (change: (current: ShowtimeSettings) => ShowtimeSettings) =>
    lock.withPermits(1)(
      Effect.gen(function* () {
        const next = change(yield* Ref.get(state));
        yield* writeJsonAtomic(fs, directory, filePath, next).pipe(Effect.orDie);
        yield* Ref.set(state, next);
        return next;
      }),
    );

  return Settings.of({
    get: Ref.get(state),
    setConnectionsEnabled: (connectionsEnabled) =>
      update((current) => ({ ...current, connectionsEnabled })),
    setHostName: (hostName) => update((current) => ({ ...current, hostName })),
  });
});

export const layer = Layer.effect(Settings, make);
