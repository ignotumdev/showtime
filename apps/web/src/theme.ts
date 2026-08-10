import * as React from "react";

export const themeStorageKey = "showtime.theme";
export const themePreferences = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof themePreferences)[number];
export type ResolvedTheme = Exclude<ThemePreference, "system">;

interface ReadableStorage {
  readonly getItem: (key: string) => string | null;
}

export const isThemePreference = (value: unknown): value is ThemePreference =>
  typeof value === "string" && themePreferences.includes(value as ThemePreference);

export const readThemePreference = (storage?: ReadableStorage): ThemePreference => {
  try {
    const value = (storage ?? window.localStorage).getItem(themeStorageKey);
    return isThemePreference(value) ? value : "system";
  } catch {
    return "system";
  }
};

export const resolveTheme = (
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme => (preference === "system" ? (systemPrefersDark ? "dark" : "light") : preference);

let preference: ThemePreference = "system";
const listeners = new Set<() => void>();

const systemPrefersDark = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;

const applyTheme = () => {
  if (typeof document === "undefined") return;

  const resolved = resolveTheme(preference, systemPrefersDark());
  const dark = resolved === "dark";
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = resolved;
  root.style.backgroundColor = dark ? "#0a0a0a" : "#ffffff";
  document.querySelector('meta[name="color-scheme"]')?.setAttribute("content", resolved);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", dark ? "#0a0a0a" : "#ffffff");
  window.showtime?.setAppearance(resolved);
};

const emitChange = () => {
  for (const listener of listeners) listener();
};

export const initializeTheme = () => {
  preference = readThemePreference();
  applyTheme();

  if (typeof window === "undefined") return () => undefined;

  const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
  const onColorSchemeChange = () => {
    if (preference === "system") applyTheme();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== themeStorageKey) return;
    const next = readThemePreference();
    const changed = next !== preference;
    preference = next;
    applyTheme();
    if (changed) emitChange();
  };

  colorScheme.addEventListener("change", onColorSchemeChange);
  window.addEventListener("storage", onStorage);
  return () => {
    colorScheme.removeEventListener("change", onColorSchemeChange);
    window.removeEventListener("storage", onStorage);
  };
};

export const setThemePreference = (next: ThemePreference) => {
  const changed = next !== preference;
  preference = next;
  try {
    window.localStorage.setItem(themeStorageKey, next);
  } catch {
    // Keep the selected theme for this session when storage is unavailable.
  }
  applyTheme();
  if (changed) emitChange();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useThemePreference = () =>
  React.useSyncExternalStore(
    subscribe,
    () => preference,
    () => "system" as const,
  );
