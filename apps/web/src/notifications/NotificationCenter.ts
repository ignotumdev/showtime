import { Toast } from "@base-ui/react/toast";
import type { Color } from "@showtime/contracts";

export interface AppNotification {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly priority?: "low" | "high";
  readonly timeout?: number;
  readonly kind: "chat" | "system";
  readonly chat?: {
    readonly senderName: string;
    readonly senderColor?: Color;
    readonly channelName: string;
    readonly showName: string;
  };
}

export const notificationManager = Toast.createToastManager<AppNotification>();
const listeners = new Set<(notification: AppNotification) => void>();

export const subscribeNotifications = (listener: (notification: AppNotification) => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
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
