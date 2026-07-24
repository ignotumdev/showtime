import type { ProfileId, ShowId } from "@showtime/contracts";

const availableDialogs = new Map<string, Set<symbol>>();

const dialogKey = (showId: ShowId, profileId: ProfileId) => `${showId}:${profileId}`;

export const registerChatAnswerDialog = (showId: ShowId, profileId: ProfileId) => {
  const key = dialogKey(showId, profileId);
  const registration = Symbol(key);
  const registrations = availableDialogs.get(key) ?? new Set<symbol>();
  registrations.add(registration);
  availableDialogs.set(key, registrations);

  return () => {
    const current = availableDialogs.get(key);
    if (!current) return;
    current.delete(registration);
    if (current.size === 0) availableDialogs.delete(key);
  };
};

export const isChatAnswerDialogAvailable = (showId: ShowId, profileId: ProfileId) =>
  (availableDialogs.get(dialogKey(showId, profileId))?.size ?? 0) > 0;
