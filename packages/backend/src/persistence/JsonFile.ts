import { Effect, Schema } from "effect";
import type { FileSystem } from "effect/FileSystem";

export const isNotFound = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "reason" in error &&
  typeof error.reason === "object" &&
  error.reason !== null &&
  "_tag" in error.reason &&
  error.reason._tag === "NotFound";

export const readJson = <S extends Schema.Constraint>(
  fs: FileSystem,
  filePath: string,
  schema: S,
) =>
  fs.readFileString(filePath).pipe(
    Effect.flatMap((contents) =>
      Effect.try({ try: () => JSON.parse(contents) as unknown, catch: (cause) => cause }),
    ),
    Effect.flatMap(Schema.decodeUnknownEffect(schema)),
  );

export const writeJsonAtomic = <A>(fs: FileSystem, directory: string, filePath: string, value: A) =>
  Effect.gen(function* () {
    yield* fs.makeDirectory(directory, { recursive: true });
    const temporaryPath = `${filePath}.tmp`;
    yield* fs.writeFileString(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
      mode: 0o600,
    });
    yield* fs.rename(temporaryPath, filePath);
    yield* fs.chmod(filePath, 0o600).pipe(Effect.ignore);
  });
