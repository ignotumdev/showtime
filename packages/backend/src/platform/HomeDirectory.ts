import { Context, Effect, Layer } from "effect";
import os from "node:os";

export class HomeDirectory extends Context.Service<
  HomeDirectory,
  {
    readonly homeDirectory: Effect.Effect<string>;
  }
>()("@showtime/backend/platform/HomeDirectory") {}

export const makeLayer = (homeDirectory: string) =>
  Layer.succeed(
    HomeDirectory,
    HomeDirectory.of({
      homeDirectory: Effect.succeed(homeDirectory),
    }),
  );

export const layerNode = Layer.effect(
  HomeDirectory,
  Effect.sync(() =>
    HomeDirectory.of({
      homeDirectory: Effect.sync(() => os.homedir()),
    }),
  ),
);
