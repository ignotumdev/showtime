import * as React from "react";
import type { Profile, ProfileId, ProfilesState } from "@showtime/contracts";

const storageKey = "showtime.selected-profile.v1";
const selectionEvent = "showtime-profile-selection";

const readSelection = (): string | undefined => {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) ?? "null") as unknown;
    return typeof parsed === "object" &&
      parsed !== null &&
      "profileId" in parsed &&
      typeof parsed.profileId === "string"
      ? parsed.profileId
      : undefined;
  } catch {
    return undefined;
  }
};

const writeSelection = (profileId: ProfileId) => {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ version: 1, profileId }));
    window.dispatchEvent(new Event(selectionEvent));
  } catch {
    // Selection remains usable for this page when storage is unavailable.
  }
};

export function useSelectedProfile(state: ProfilesState | undefined) {
  const [storedId, setStoredId] = React.useState(readSelection);
  React.useEffect(() => {
    const update = () => setStoredId(readSelection());
    window.addEventListener("storage", update);
    window.addEventListener(selectionEvent, update);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener(selectionEvent, update);
    };
  }, []);

  const selected =
    state?.profiles.find((profile) => profile.id === storedId) ??
    state?.profiles.find((profile) => profile.id === state.defaultProfileId) ??
    state?.profiles[0];

  React.useEffect(() => {
    if (selected && selected.id !== storedId) {
      writeSelection(selected.id);
      setStoredId(selected.id);
    }
  }, [selected, storedId]);

  const select = React.useCallback((profile: Profile) => {
    setStoredId(profile.id);
    writeSelection(profile.id);
  }, []);

  return { selected, select } as const;
}
