import * as React from "react";
import type { Profile, ProfileId, ProfilesState } from "@showtime/contracts";
import {
  profileSelectionChangedEvent,
  readProfileSelection,
  writeProfileSelection,
} from "@/profile-selection";
import { updateConnectionProfile } from "@/connection";

const writeSelection = (profileId: ProfileId) => {
  try {
    writeProfileSelection(profileId);
    window.dispatchEvent(new Event(profileSelectionChangedEvent));
  } catch {
    // Selection remains usable for this page when storage is unavailable.
  }
};

export function useSelectedProfile(state: ProfilesState | undefined) {
  const [storedId, setStoredId] = React.useState(readProfileSelection);
  React.useEffect(() => {
    const update = () => setStoredId(readProfileSelection());
    window.addEventListener("storage", update);
    window.addEventListener(profileSelectionChangedEvent, update);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener(profileSelectionChangedEvent, update);
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

  React.useEffect(() => {
    if (!selected) return;
    let active = true;
    let timer: number | undefined;
    let failures = 0;
    const sync = () => {
      void updateConnectionProfile(selected.id).catch(() => {
        if (!active) return;
        failures += 1;
        timer = window.setTimeout(sync, Math.min(5_000, 500 * 2 ** (failures - 1)));
      });
    };
    sync();
    return () => {
      active = false;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [selected]);

  const select = React.useCallback((profile: Profile) => {
    setStoredId(profile.id);
    writeSelection(profile.id);
  }, []);

  return { selected, select } as const;
}
