import { Effect, PubSub, Stream } from "effect";

export interface AppNotification {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly priority?: "low" | "high";
  readonly timeout?: number;
  readonly kind: "chat" | "system";
}

const pubsub = Effect.runSync(PubSub.unbounded<AppNotification>({ replay: 64 }));

export const notificationStream = Stream.fromPubSub(pubsub);

export const publishNotification = (notification: AppNotification) =>
  PubSub.publish(pubsub, notification).pipe(Effect.asVoid);

export const publishNotificationUnsafe = (notification: AppNotification) => {
  PubSub.publishUnsafe(pubsub, notification);
};
