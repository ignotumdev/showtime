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
import {
  planChatAnswerRequests,
  reconcileChatAnswerRequests,
  type AnswerRequest,
  type ChatAnswerRequestSequences,
} from "./ChatAnswerRequestPolicy";

const showId = "show_0000000000000001" as ShowId;
const channelId = "channel_0000000000000001" as ChatChannelId;
const addedChannelId = "channel_0000000000000002" as ChatChannelId;
const selectedProfileId = "profile_0000000000000001" as ProfileId;
const otherProfileId = "profile_0000000000000002" as ProfileId;

const messageId = (sequence: number) =>
  `message_${sequence.toString(36).padStart(16, "0")}` as ChatMessageId;

const message = (sequence: number, overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: messageId(sequence),
  sequence: sequence as ChatSequence,
  showId,
  channelId,
  senderProfileId: otherProfileId,
  body: `Message ${sequence}` as ChatMessage["body"],
  sentAt: DateTime.makeUnsafe(sequence),
  ...overrides,
});

const request = (sequence: number, overrides: Partial<ChatMessage> = {}): AnswerRequest =>
  message(sequence, {
    answer: {
      template: "{{answer}}" as NonNullable<ChatMessage["answer"]>["template"],
      fields: [{ name: "answer", type: "text" }],
    },
    ...overrides,
  }) as AnswerRequest;

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

describe("chat answer request policy", () => {
  it("finds unanswered requests after the read cursor in the first snapshot", () => {
    const pending = request(3);
    const planned = planChatAnswerRequests({
      channels: [
        channel({
          messages: [request(1), message(2), pending],
          lastReadSequence: 1 as ChatSequence,
          newestSequence: 3 as ChatSequence,
        }),
      ],
      profileId: selectedProfileId,
      previousSequences: undefined,
      shouldPrompt: true,
    });

    expect(planned.requests).toEqual([pending]);
    expect(planned.sequences.get(channelId)).toBe(3);
  });

  it("uses the read cursor when a channel is added after initialization", () => {
    const pending = request(4, { channelId: addedChannelId });
    const previousSequences: ChatAnswerRequestSequences = new Map([[channelId, 8 as ChatSequence]]);
    const planned = planChatAnswerRequests({
      channels: [
        channel({
          id: addedChannelId,
          messages: [request(2, { channelId: addedChannelId }), pending],
          lastReadSequence: 2 as ChatSequence,
          newestSequence: 4 as ChatSequence,
        }),
      ],
      profileId: selectedProfileId,
      previousSequences,
      shouldPrompt: true,
    });

    expect(planned.requests).toEqual([pending]);
  });

  it("excludes requests already answered by the selected profile", () => {
    const answeredRequest = request(2);
    const reply = message(3, {
      senderProfileId: selectedProfileId,
      replyToMessageId: answeredRequest.id,
    });
    const planned = planChatAnswerRequests({
      channels: [
        channel({
          messages: [answeredRequest, reply],
          newestSequence: 3 as ChatSequence,
        }),
      ],
      profileId: selectedProfileId,
      previousSequences: undefined,
      shouldPrompt: true,
    });

    expect(planned.requests).toEqual([]);
  });

  it("advances cursors without prompting while the drawer is open", () => {
    const planned = planChatAnswerRequests({
      channels: [channel({ messages: [request(2)], newestSequence: 2 as ChatSequence })],
      profileId: selectedProfileId,
      previousSequences: undefined,
      shouldPrompt: false,
    });

    expect(planned.requests).toEqual([]);
    expect(planned.sequences.get(channelId)).toBe(2);
  });

  it("drops queued requests when their channel is deleted", () => {
    const stale = request(2);
    const available = request(3, { channelId: addedChannelId });

    const reconciled = reconcileChatAnswerRequests({
      queued: [stale, available],
      incoming: [available],
      channelIds: new Set([addedChannelId]),
    });

    expect(reconciled).toEqual([available]);
  });
});
