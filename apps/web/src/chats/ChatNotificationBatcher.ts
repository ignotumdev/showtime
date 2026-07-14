import type { AppNotification } from "../notifications/NotificationCenter";
import { publishNotification } from "../notifications/NotificationCenter";

export interface ChatNotificationDelivery {
  readonly notification: AppNotification;
  readonly messageCount: number;
}

export const collapseChatNotificationDeliveries = (
  deliveries: ReadonlyArray<ChatNotificationDelivery>,
): AppNotification | undefined => {
  const first = deliveries[0];
  if (!first) return undefined;

  const messageCount = deliveries.reduce((total, delivery) => total + delivery.messageCount, 0);
  if (messageCount <= 1) return first.notification;

  const channelNames = [
    ...new Set(
      deliveries.flatMap((delivery) =>
        delivery.notification.chat ? [delivery.notification.chat.channelName] : [],
      ),
    ),
  ];
  const timestamp = deliveries.reduce<number | undefined>((latest, delivery) => {
    const candidate = delivery.notification.timestamp;
    return candidate === undefined || (latest !== undefined && latest >= candidate)
      ? latest
      : candidate;
  }, undefined);

  return {
    id: `chat-missed:${first.notification.id}:${messageCount}`,
    kind: "chat",
    title: `${messageCount} new messages`,
    description: channelNames.map((name) => `#${name}`).join(", "),
    timestamp,
    chat: first.notification.chat ? { ...first.notification.chat, summary: true } : undefined,
  };
};

/**
 * Notifications queued during one browser update turn are catch-up peers. A
 * later stream update gets a new turn, so ordinary messages sent in sequence
 * continue to produce individual notifications.
 */
export const makeChatNotificationBatcher = (
  publish: (notification: AppNotification) => void,
  schedule: (flush: () => void) => void = queueMicrotask,
) => {
  const pending: Array<ChatNotificationDelivery> = [];
  let flushScheduled = false;

  return (delivery: ChatNotificationDelivery) => {
    pending.push(delivery);
    if (flushScheduled) return;
    flushScheduled = true;
    schedule(() => {
      flushScheduled = false;
      const notification = collapseChatNotificationDeliveries(pending.splice(0));
      if (notification) publish(notification);
    });
  };
};

export const enqueueChatNotification = makeChatNotificationBatcher(publishNotification);
