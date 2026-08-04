import { Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";
import {
  bindChatPresetAnswer,
  chatPresetPlaceholderNames,
  chatPresetTemplateIsSinglePlaceholder,
  ChatChannel,
  ChatPresetTemplate,
  resolveChatPresetTemplate,
  validateChatPresetAnswerDefinition,
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
  it("identifies templates that contain exactly one placeholder", () => {
    expect(chatPresetTemplateIsSinglePlaceholder("{{status}}")).toBe(true);
    expect(chatPresetTemplateIsSinglePlaceholder("{{ status }}")).toBe(true);
    expect(chatPresetTemplateIsSinglePlaceholder("Status: {{status}}")).toBe(false);
    expect(chatPresetTemplateIsSinglePlaceholder("{{status}}\n")).toBe(false);
    expect(chatPresetTemplateIsSinglePlaceholder("{{status}} {{level}}")).toBe(false);
  });

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

  it("accepts and resolves preset messages without placeholders", () => {
    const template = ChatPresetTemplate.make("Soundcheck starts in five minutes.");

    expect(validateChatPresetDefinition({ template, fields: [] })).toBeUndefined();
    expect(resolveChatPresetTemplate(template, new Map())).toEqual({
      body: "Soundcheck starts in five minutes.",
      parts: [{ type: "text", text: "Soundcheck starts in five minutes." }],
    });
  });

  it("accepts, binds, and resolves preset answers without placeholders", () => {
    const answer = {
      template: ChatPresetTemplate.make("Acknowledged."),
      fields: [],
    } as const;

    expect(validateChatPresetAnswerDefinition(answer, [])).toBeUndefined();
    expect(bindChatPresetAnswer(answer, new Map())).toEqual(answer);
    expect(resolveChatPresetTemplate(answer.template, new Map())).toEqual({
      body: "Acknowledged.",
      parts: [{ type: "text", text: "Acknowledged." }],
    });
  });

  it("resolves repeated placeholders into rich message parts", () => {
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
    expect(resolved.parts).toEqual([
      { type: "text", text: "Check " },
      microphone,
      { type: "text", text: ", then mute " },
      microphone,
      { type: "text", text: "." },
    ]);
  });

  it("inherits message values in answer templates", () => {
    const microphone = {
      type: "microphone",
      id: MicrophoneId.make("mic_1234567890abcdef"),
      number: MicrophoneNumber.make("7"),
      color: "violet",
      name: "Lead",
      text: "Mic 7 (Lead)",
    } as const satisfies ChatMessagePart;
    const answer = {
      template: ChatPresetTemplate.make("{{mic}} is {{status}}"),
      fields: [{ name: "status", type: "select", options: ["Ready", "Not ready"] }],
    } as const;

    expect(validateChatPresetAnswerDefinition(answer, ["mic"])).toBeUndefined();
    const bound = bindChatPresetAnswer(answer, new Map([["mic", microphone]]))!;
    expect(bound.context).toEqual([{ name: "mic", part: microphone }]);
    const resolved = resolveChatPresetTemplate(
      bound.template,
      new Map<string, ChatMessagePart>([
        ["mic", microphone],
        ["status", { type: "text", text: "Ready" } as const],
      ]),
    )!;
    expect(resolved.body).toBe("Mic 7 (Lead) is Ready");
    expect(resolved.parts[0]).toBe(microphone);
  });
});
