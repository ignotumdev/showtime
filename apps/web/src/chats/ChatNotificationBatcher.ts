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

const groupByNavigationTarget = (deliveries: ReadonlyArray<ChatNotificationDelivery>) => {
  const groups = new Map<string, Array<ChatNotificationDelivery>>();
  for (const delivery of deliveries) {
    const chat = delivery.notification.chat;
    const key = chat
      ? `${chat.showId}:${chat.channelId}`
      : `notification:${delivery.notification.id}`;
    const group = groups.get(key);
    if (group) group.push(delivery);
    else groups.set(key, [delivery]);
  }
  return groups.values();
};

/**
 * Notifications for the same navigation target queued during one browser
 * update turn are catch-up peers. A later stream update gets a new turn, so
 * ordinary messages sent in sequence continue to produce individual
 * notifications.
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
      for (const deliveries of groupByNavigationTarget(pending.splice(0))) {
        const notification = collapseChatNotificationDeliveries(deliveries);
        if (notification) publish(notification);
      }
    });
  };
};

export const enqueueChatNotification = makeChatNotificationBatcher(publishNotification);
