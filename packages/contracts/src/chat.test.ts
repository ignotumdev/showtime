import { Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { ChatChannel } from "./chat.js";

const validChannel = {
  id: "channel_1234567890abcdef",
  showId: "show_1234567890abcdef",
  name: "General",
  createdAt: "2026-07-14T10:00:00.000Z",
  messages: [],
  messageCount: 0,
  incomingMessageCount: 0,
  unreadCount: 0,
  lastReadSequence: 0,
  earliestReplaySequence: 0,
  newestSequence: 0,
  notificationsEnabled: true,
} as const;

const decode = Schema.decodeUnknownSync(ChatChannel);

describe("ChatChannel", () => {
  it.each(["messageCount", "incomingMessageCount", "unreadCount"] as const)(
    "rejects a negative %s",
    (field) => {
      expect(() => decode({ ...validChannel, [field]: -1 })).toThrow();
    },
  );
});
