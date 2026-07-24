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
  messageHandledElsewhere = () => false,
}: {
  readonly previous: ChatNotificationCursor | undefined;
  readonly channel: ChatChannel;
  readonly profileId: ProfileId;
  readonly visibleAtBottom: boolean;
  readonly messageHandledElsewhere?: (message: ChatMessage) => boolean;
}): {
  readonly cursor: ChatNotificationCursor;
  readonly blink: boolean;
  readonly latestIncomingMessage?: ChatMessage;
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
  if (!blink) return { cursor, blink, notifications: [] };

  const messages = channel.messages.filter(
    (message) => message.sequence > previous.sequence && message.senderProfileId !== profileId,
  );
  const latestIncomingMessage = messages[messages.length - 1];
  if (visibleAtBottom) return { cursor, blink, latestIncomingMessage, notifications: [] };
  const unhandledMessages = messages.filter((message) => !messageHandledElsewhere(message));
  const handledCount = messages.length - unhandledMessages.length;
  const unhandledMissedCount = Math.max(0, missedCount - handledCount);
  return missedCount > messages.length
    ? {
        cursor,
        blink,
        latestIncomingMessage,
        notifications:
          unhandledMissedCount > 0 ? [{ kind: "summary", count: unhandledMissedCount }] : [],
      }
    : {
        cursor,
        blink,
        latestIncomingMessage,
        notifications: unhandledMessages.map((message) => ({ kind: "message" as const, message })),
      };
};
