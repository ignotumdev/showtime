import { Toast } from "@base-ui/react/toast";
import type { ChatChannelId, ChatMessagePart, Color, ShowId } from "@showtime/contracts";

export interface AppNotification {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly descriptionParts?: ReadonlyArray<ChatMessagePart>;
  readonly timestamp?: number;
  readonly priority?: "low" | "high";
  readonly timeout?: number;
  readonly kind: "chat" | "system";
  readonly chat?: {
    readonly showId: ShowId;
    readonly channelId: ChatChannelId;
    readonly senderName?: string;
    readonly senderColor?: Color;
    readonly channelName: string;
    readonly summary?: boolean;
  };
}

export const notificationManager = Toast.createToastManager<AppNotification>();
const listeners = new Set<(notification: AppNotification) => void>();
const blinkListeners = new Set<(color: Color | undefined) => void>();

export const subscribeNotifications = (listener: (notification: AppNotification) => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const subscribeNotificationBlinks = (listener: (color: Color | undefined) => void) => {
  blinkListeners.add(listener);
  return () => {
    blinkListeners.delete(listener);
  };
};

export const publishNotificationBlink = (color?: Color) => {
  for (const listener of blinkListeners) listener(color);
};

export const publishNotification = (notification: AppNotification) => {
  notificationManager.add({
    id: notification.id,
    title: notification.title,
    description: notification.description,
    priority: notification.priority,
    timeout: notification.timeout,
    type: notification.kind,
    data: notification,
  });
  for (const listener of listeners) listener(notification);
};
