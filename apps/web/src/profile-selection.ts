import type { ProfileId } from "@showtime/contracts";

export const profileSelectionStorageKey = "showtime.selected-profile.v1";
export const profileSelectionChangedEvent = "showtime-profile-selection";

type ReadableStorage = Pick<Storage, "getItem">;
type WritableStorage = Pick<Storage, "setItem">;

export const readProfileSelection = (
  storage: ReadableStorage = localStorage,
): string | undefined => {
  try {
    const parsed = JSON.parse(storage.getItem(profileSelectionStorageKey) ?? "null") as unknown;
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

export const writeProfileSelection = (
  profileId: ProfileId,
  storage: WritableStorage = localStorage,
) => {
  storage.setItem(profileSelectionStorageKey, JSON.stringify({ version: 1, profileId }));
};
