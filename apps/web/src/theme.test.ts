import { describe, expect, it } from "vite-plus/test";
import { readThemePreference, resolveTheme, themeStorageKey } from "./theme";

const storageWith = (value: string | null) => ({
  getItem: (key: string) => (key === themeStorageKey ? value : null),
});

describe("theme preference", () => {
  it.each(["system", "light", "dark"] as const)("reads the persisted %s preference", (theme) => {
    expect(readThemePreference(storageWith(theme))).toBe(theme);
  });

  it.each([null, "", "midnight", "DARK"])(
    "defaults an invalid preference (%s) to system",
    (value) => {
      expect(readThemePreference(storageWith(value))).toBe("system");
    },
  );

  it("follows the system only for the system preference", () => {
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
});
