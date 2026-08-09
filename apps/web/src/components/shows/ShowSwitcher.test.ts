import { describe, expect, it } from "vite-plus/test";
import { globalSettingsSectionFromParams } from "./ShowSwitcher";

describe("globalSettingsSectionFromParams", () => {
  it.each(["connections", "profiles", "updates"] as const)(
    "preserves the %s global settings section",
    (section) => {
      expect(globalSettingsSectionFromParams(section)).toBe(section);
    },
  );

  it.each([
    "general",
    "chat",
    "toString",
    "constructor",
    "hasOwnProperty",
    "__proto__",
    undefined,
    null,
  ])("falls back to updates for a non-global section (%s)", (section) => {
    expect(globalSettingsSectionFromParams(section)).toBe("updates");
  });
});
