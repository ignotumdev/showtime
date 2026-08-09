import { DateTime } from "effect";
import { describe, expect, it } from "vite-plus/test";
import type {
  ChatChannelId,
  ChatMessage,
  ChatMessageId,
  ChatSequence,
  ProfileId,
  ShowId,
} from "@showtime/contracts";
import {
  areChatMessagesInSameGroup,
  CHAT_MESSAGE_GROUP_WINDOW_MILLIS,
} from "./ChatMessageGrouping";

const showId = "show_0000000000000001" as ShowId;
const channelId = "channel_0000000000000001" as ChatChannelId;
const profileId = "profile_0000000000000001" as ProfileId;

function message(sentAt: number, senderProfileId: ProfileId = profileId): ChatMessage {
  return {
    id: `message_${sentAt.toString(36).padStart(16, "0")}` as ChatMessageId,
    sequence: sentAt as ChatSequence,
    showId,
    channelId,
    senderProfileId,
    body: "Message" as ChatMessage["body"],
    sentAt: DateTime.makeUnsafe(sentAt),
  };
}

describe("chat message grouping", () => {
  it("groups consecutive messages from the same profile within five minutes", () => {
    expect(areChatMessagesInSameGroup(message(0), message(CHAT_MESSAGE_GROUP_WINDOW_MILLIS))).toBe(
      true,
    );
  });

  it("starts a new group after five minutes", () => {
    expect(
      areChatMessagesInSameGroup(message(0), message(CHAT_MESSAGE_GROUP_WINDOW_MILLIS + 1)),
    ).toBe(false);
  });

  it("starts a new group when the profile changes", () => {
    const anotherProfileId = "profile_0000000000000002" as ProfileId;
    expect(areChatMessagesInSameGroup(message(0), message(1, anotherProfileId))).toBe(false);
  });

  it("does not group messages whose timestamps are out of order", () => {
    expect(areChatMessagesInSameGroup(message(1), message(0))).toBe(false);
  });
});
