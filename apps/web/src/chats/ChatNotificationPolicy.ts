import type { ChatChannel, ChatMessage, ChatSequence, ProfileId } from "@showtime/contracts";

export interface ChatNotificationCursor {
  readonly sequence: ChatSequence;
  readonly count: number;
}

export type PlannedChatNotification =
  | { readonly kind: "message"; readonly message: ChatMessage }
  | { readonly kind: "summary"; readonly count: number };

export const planChatNotifications = ({
  previous,
  channel,
  profileId,
  visibleAtBottom,
}: {
  readonly previous: ChatNotificationCursor | undefined;
  readonly channel: ChatChannel;
  readonly profileId: ProfileId;
  readonly visibleAtBottom: boolean;
}): {
  readonly cursor: ChatNotificationCursor;
  readonly blink: boolean;
  readonly notifications: ReadonlyArray<PlannedChatNotification>;
} => {
  const cursor = {
    sequence: channel.newestSequence,
    count: channel.incomingMessageCount,
  } satisfies ChatNotificationCursor;
  if (
    !previous ||
    (channel.newestSequence <= previous.sequence && channel.incomingMessageCount <= previous.count)
  ) {
    return { cursor, blink: false, notifications: [] };
  }

  const missedCount = Math.max(0, channel.incomingMessageCount - previous.count);
  const blink = channel.notificationsEnabled && missedCount > 0;
  if (!blink || visibleAtBottom) return { cursor, blink, notifications: [] };

  const messages = channel.messages.filter(
    (message) => message.sequence > previous.sequence && message.senderProfileId !== profileId,
  );
  return missedCount > messages.length
    ? { cursor, blink, notifications: [{ kind: "summary", count: missedCount }] }
    : {
        cursor,
        blink,
        notifications: messages.map((message) => ({ kind: "message" as const, message })),
      };
};
