import { Effect, Option } from "effect";
import { FileSystem } from "effect/FileSystem";
import { isShowtimeThemePreference, type ShowtimeThemePreference } from "@showtime/shared";

export const appearancePreferenceFileName = "appearance-theme";

export const readAppearancePreference = (filePath: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem;
    const stored = yield* fs.readFileString(filePath).pipe(Effect.option);
    if (Option.isNone(stored)) return "system" as const;

    const preference = stored.value.trim();
    return isShowtimeThemePreference(preference) ? preference : ("system" as const);
  });

export const writeAppearancePreference = (filePath: string, preference: ShowtimeThemePreference) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem;
    yield* fs.writeFileString(filePath, preference, { mode: 0o600 });
  });
