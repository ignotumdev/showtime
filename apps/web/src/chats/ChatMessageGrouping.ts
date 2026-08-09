import { DateTime } from "effect";
import type { ChatMessage } from "@showtime/contracts";

export const CHAT_MESSAGE_GROUP_WINDOW_MILLIS = 5 * 60 * 1_000;

export function areChatMessagesInSameGroup(
  previous: ChatMessage | undefined,
  current: ChatMessage | undefined,
): boolean {
  if (!previous || !current || previous.senderProfileId !== current.senderProfileId) {
    return false;
  }

  const elapsed = DateTime.toEpochMillis(current.sentAt) - DateTime.toEpochMillis(previous.sentAt);

  return elapsed >= 0 && elapsed <= CHAT_MESSAGE_GROUP_WINDOW_MILLIS;
}
