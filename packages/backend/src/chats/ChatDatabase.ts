import { SqliteClient } from "@effect/sql-sqlite-node";
import { Effect, Layer, Path } from "effect";
import { FileSystem } from "effect/FileSystem";
import * as HomeDirectory from "../platform/HomeDirectory.js";

export const layer = Layer.unwrap(
  Effect.gen(function* () {
    const fs = yield* FileSystem;
    const path = yield* Path.Path;
    const home = yield* HomeDirectory.HomeDirectory;
    const directory = path.join(yield* home.homeDirectory, ".showtime");
    yield* fs.makeDirectory(directory, { recursive: true });
    return SqliteClient.layer({ filename: path.join(directory, "chats.db") });
  }),
);
