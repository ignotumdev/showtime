import { describe, expect, it } from "vite-plus/test";
import type { ChatChannelId, ShowId } from "@showtime/contracts";
import type { AppNotification } from "../notifications/NotificationCenter";
import {
  collapseChatNotificationDeliveries,
  makeChatNotificationBatcher,
} from "./ChatNotificationBatcher";

const notification = (
  id: string,
  channelId = "channel_0000000000000001",
  channelName = "General",
  showId = "show_0000000000000001",
) =>
  ({
    id,
    kind: "chat",
    title: "A message",
    description: "Message body",
    timestamp: id === "second" ? 2 : 1,
    chat: {
      showId: showId as ShowId,
      channelId: channelId as ChatChannelId,
      channelName,
    },
  }) satisfies AppNotification;

describe("chat notification batching", () => {
  it("leaves a single message notification unchanged", () => {
    const first = notification("first");
    expect(collapseChatNotificationDeliveries([{ notification: first, messageCount: 1 }])).toBe(
      first,
    );
  });

  it("collapses simultaneous deliveries for the same navigation target", () => {
    const first = notification("first");
    const collapsed = collapseChatNotificationDeliveries([
      { notification: first, messageCount: 2 },
      {
        notification: notification("second"),
        messageCount: 3,
      },
    ]);

    expect(collapsed).toMatchObject({
      kind: "chat",
      title: "5 new messages",
      description: "#General",
      timestamp: 2,
      chat: { ...first.chat, summary: true },
    });
  });

  it("does not combine messages delivered after the current update turn", () => {
    const scheduled: Array<() => void> = [];
    const published: Array<AppNotification> = [];
    const enqueue = makeChatNotificationBatcher(
      (item) => published.push(item),
      (flush) => scheduled.push(flush),
    );

    enqueue({ notification: notification("first"), messageCount: 1 });
    enqueue({ notification: notification("second"), messageCount: 1 });
    expect(scheduled).toHaveLength(1);
    scheduled.shift()?.();

    enqueue({ notification: notification("later"), messageCount: 1 });
    scheduled.shift()?.();

    expect(published.map((item) => item.title)).toEqual(["2 new messages", "A message"]);
  });

  it("publishes separate notifications for simultaneous deliveries with different targets", () => {
    const scheduled: Array<() => void> = [];
    const published: Array<AppNotification> = [];
    const enqueue = makeChatNotificationBatcher(
      (item) => published.push(item),
      (flush) => scheduled.push(flush),
    );

    enqueue({ notification: notification("first"), messageCount: 1 });
    enqueue({
      notification: notification("second", "channel_0000000000000002", "Stage"),
      messageCount: 1,
    });
    enqueue({
      notification: notification(
        "third",
        "channel_0000000000000001",
        "General",
        "show_0000000000000002",
      ),
      messageCount: 1,
    });
    scheduled.shift()?.();

    expect(published.map((item) => item.id)).toEqual(["first", "second", "third"]);
    expect(published.map((item) => item.chat)).toMatchObject([
      { showId: "show_0000000000000001", channelId: "channel_0000000000000001" },
      { showId: "show_0000000000000001", channelId: "channel_0000000000000002" },
      { showId: "show_0000000000000002", channelId: "channel_0000000000000001" },
    ]);
  });
});
