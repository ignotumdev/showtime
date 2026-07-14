import { ProfileId } from "@showtime/contracts";
import { Schema } from "effect";

export const profileSelectionStorageKey = "showtime.selected-profile.v1";
export const profileSelectionChangedEvent = "showtime-profile-selection";

type ReadableStorage = Pick<Storage, "getItem">;
type WritableStorage = Pick<Storage, "setItem">;

export const readProfileSelection = (
  storage: ReadableStorage = localStorage,
): ProfileId | undefined => {
  try {
    const parsed = JSON.parse(storage.getItem(profileSelectionStorageKey) ?? "null") as unknown;
    return typeof parsed === "object" &&
      parsed !== null &&
      "profileId" in parsed &&
      Schema.is(ProfileId)(parsed.profileId)
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
