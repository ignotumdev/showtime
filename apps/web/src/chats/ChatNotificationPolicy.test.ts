import { DateTime } from "effect";
import { describe, expect, it } from "vite-plus/test";
import type {
  ChatChannel,
  ChatChannelId,
  ChatMessage,
  ChatMessageId,
  ChatSequence,
  ProfileId,
  ShowId,
} from "@showtime/contracts";
import { planChatNotifications, type ChatNotificationCursor } from "./ChatNotificationPolicy";

const showId = "show_0000000000000001" as ShowId;
const channelId = "channel_0000000000000001" as ChatChannelId;
const selectedProfileId = "profile_0000000000000001" as ProfileId;
const otherProfileId = "profile_0000000000000002" as ProfileId;

const message = (sequence: number, senderProfileId = otherProfileId): ChatMessage => ({
  id: `message_${sequence.toString(36).padStart(16, "0")}` as ChatMessageId,
  sequence: sequence as ChatSequence,
  showId,
  channelId,
  senderProfileId,
  body: `Message ${sequence}` as ChatMessage["body"],
  sentAt: DateTime.makeUnsafe(sequence),
});

const channel = (overrides: Partial<ChatChannel> = {}): ChatChannel => ({
  id: channelId,
  showId,
  name: "General" as ChatChannel["name"],
  createdAt: DateTime.makeUnsafe(0),
  messages: [],
  messageCount: 0,
  incomingMessageCount: 0,
  unreadCount: 0,
  lastReadSequence: 0 as ChatSequence,
  earliestReplaySequence: 0 as ChatSequence,
  newestSequence: 0 as ChatSequence,
  notificationsEnabled: true,
  ...overrides,
});

const cursor = (sequence: number, count: number): ChatNotificationCursor => ({
  sequence: sequence as ChatSequence,
  count,
});

describe("chat notification policy", () => {
  it("initializes without replaying existing history", () => {
    const planned = planChatNotifications({
      previous: undefined,
      channel: channel({
        messages: [message(1)],
        messageCount: 1,
        incomingMessageCount: 1,
        newestSequence: 1 as ChatSequence,
      }),
      profileId: selectedProfileId,
      visibleAtBottom: false,
    });
    expect(planned.notifications).toEqual([]);
    expect(planned.cursor).toEqual({ sequence: 1, count: 1 });
  });

  it("emits each replayed incoming message while excluding the selected profile's messages", () => {
    const incomingMessage5 = message(5);
    const incomingMessage6 = message(6);
    const planned = planChatNotifications({
      previous: cursor(3, 1),
      channel: channel({
        messages: [message(4, selectedProfileId), incomingMessage5, incomingMessage6],
        messageCount: 6,
        incomingMessageCount: 3,
        newestSequence: 6 as ChatSequence,
      }),
      profileId: selectedProfileId,
      visibleAtBottom: false,
    });
    expect(planned.notifications).toEqual([
      { kind: "message", message: incomingMessage5 },
      { kind: "message", message: incomingMessage6 },
    ]);
    expect(planned.cursor).toEqual({ sequence: 6, count: 3 });
  });

  it("summarizes an overflow gap with the exact incoming count", () => {
    const planned = planChatNotifications({
      previous: cursor(10, 4),
      channel: channel({
        messages: [message(109), message(110)],
        messageCount: 110,
        incomingMessageCount: 75,
        newestSequence: 110 as ChatSequence,
      }),
      profileId: selectedProfileId,
      visibleAtBottom: false,
    });
    expect(planned.notifications).toEqual([{ kind: "summary", count: 71 }]);
    expect(planned.cursor).toEqual({ sequence: 110, count: 75 });
  });

  it("suppresses notifications while visible at bottom or when the channel is muted", () => {
    for (const candidate of [
      { visibleAtBottom: true, notificationsEnabled: true },
      { visibleAtBottom: false, notificationsEnabled: false },
    ]) {
      const planned = planChatNotifications({
        previous: cursor(1, 1),
        channel: channel({
          messages: [message(2)],
          messageCount: 2,
          incomingMessageCount: 2,
          newestSequence: 2 as ChatSequence,
          notificationsEnabled: candidate.notificationsEnabled,
        }),
        profileId: selectedProfileId,
        visibleAtBottom: candidate.visibleAtBottom,
      });
      expect(planned.notifications).toEqual([]);
      expect(planned.cursor).toEqual({ sequence: 2, count: 2 });
    }
  });
});
