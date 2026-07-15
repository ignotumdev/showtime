import { Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";
import {
  chatPresetPlaceholderNames,
  ChatChannel,
  ChatMessageBody,
  decodeStoredChatMessage,
  encodeStoredChatMessage,
  resolveChatPresetTemplate,
  validateChatPresetDefinition,
  type ChatMessagePart,
} from "./chat.js";
import { MicrophoneId, MicrophoneNumber } from "./microphone.js";

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

describe("chat presets", () => {
  it("extracts unique placeholders in message order and validates field definitions", () => {
    expect(chatPresetPlaceholderNames("Put {{ mic }} in {{mix}}, then check {{mic}}")).toEqual([
      "mic",
      "mix",
    ]);
    expect(
      validateChatPresetDefinition({
        template: "Put {{mic}} in {{mix}}",
        fields: [
          { name: "mic", type: "microphone" },
          { name: "mix", type: "select", options: ["Main", "Monitors"] },
        ],
      }),
    ).toBeUndefined();
    expect(
      validateChatPresetDefinition({
        template: "Put {{mic}} in {{mix}}",
        fields: [{ name: "mic", type: "microphone" }],
      }),
    ).toContain("Every template placeholder");
  });

  it("resolves repeated placeholders and round-trips rich stored messages", () => {
    const microphone = {
      type: "microphone",
      id: MicrophoneId.make("mic_1234567890abcdef"),
      number: MicrophoneNumber.make("7"),
      color: "violet",
      name: "Lead",
      text: "Mic 7 (Lead)",
    } as const satisfies ChatMessagePart;
    const resolved = resolveChatPresetTemplate(
      "Check {{mic}}, then mute {{mic}}.",
      new Map([["mic", microphone]]),
    )!;
    expect(resolved.body).toBe("Check Mic 7 (Lead), then mute Mic 7 (Lead).");
    const body = ChatMessageBody.make(resolved.body);
    expect(decodeStoredChatMessage(encodeStoredChatMessage(body, resolved.parts))).toEqual({
      body,
      parts: resolved.parts,
    });
  });

  it("treats malformed rich envelopes as ordinary text", () => {
    const malformed = '__showtime_chat_v1__:{"body":"Visible","parts":[]}';
    expect(decodeStoredChatMessage(malformed)).toEqual({ body: malformed });
  });

  it("decodes legacy rich envelopes already stored in history", () => {
    const legacy =
      '__showtime_chat_v1__:{"body":"Visible","parts":[{"type":"text","text":"Visible"}]}';

    expect(decodeStoredChatMessage(legacy)).toEqual({
      body: "Visible",
      parts: [{ type: "text", text: "Visible" }],
    });
  });

  it("round-trips plain messages that look like legacy rich envelopes", () => {
    const body = ChatMessageBody.make(
      '__showtime_chat_v1__:{"body":"Rewritten","parts":[{"type":"text","text":"Rewritten"}]}',
    );

    expect(decodeStoredChatMessage(encodeStoredChatMessage(body))).toEqual({ body });
  });

  it("rejects current envelopes without an explicit encoding kind", () => {
    const ambiguous =
      '__showtime_chat_v2__:{"body":"Visible","parts":[{"type":"text","text":"Visible"}]}';

    expect(decodeStoredChatMessage(ambiguous)).toEqual({ body: ambiguous });
  });
});
