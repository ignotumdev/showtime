import { Toast } from "@base-ui/react/toast";

export interface AppNotification {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly priority?: "low" | "high";
  readonly timeout?: number;
  readonly kind: "chat" | "system";
}

export const notificationManager = Toast.createToastManager<AppNotification>();

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
};
