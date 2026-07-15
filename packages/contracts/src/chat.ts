import { Schema } from "effect";
import { idAlphabet, idSuffixLength } from "./ids.js";
import { Color } from "./color.js";
import { MicrophoneId, MicrophoneNumber } from "./microphone.js";
import { MixId, MixNumber } from "./mix.js";
import { ProfileId } from "./profile.js";
import { ShowId } from "./show.js";

const id = (prefix: string, label: string) =>
  Schema.String.pipe(
    Schema.check(
      Schema.isPattern(new RegExp(`^${prefix}[${idAlphabet}]{${idSuffixLength}}$`), {
        expected: `${label} id`,
      }),
    ),
  );

export const chatChannelIdPrefix = "channel_";
export const ChatChannelId = id(chatChannelIdPrefix, "chat channel").pipe(
  Schema.brand("ChatChannelId"),
);
export type ChatChannelId = typeof ChatChannelId.Type;

export const chatMessageIdPrefix = "message_";
export const ChatMessageId = id(chatMessageIdPrefix, "chat message").pipe(
  Schema.brand("ChatMessageId"),
);
export type ChatMessageId = typeof ChatMessageId.Type;

export const chatPresetIdPrefix = "preset_";
export const ChatPresetId = id(chatPresetIdPrefix, "chat preset").pipe(
  Schema.brand("ChatPresetId"),
);
export type ChatPresetId = typeof ChatPresetId.Type;

const NonNegativeInt = Schema.Int.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0)));

export const ChatSequence = NonNegativeInt.pipe(Schema.brand("ChatSequence"));
export type ChatSequence = typeof ChatSequence.Type;

const NonBlankTrimmed = Schema.String.pipe(
  Schema.check(
    Schema.makeFilter((value) => value.trim().length > 0, { expected: "non-empty text" }),
  ),
);

export const ChatChannelName = NonBlankTrimmed.pipe(
  Schema.check(Schema.isMaxLength(60)),
  Schema.brand("ChatChannelName"),
);
export type ChatChannelName = typeof ChatChannelName.Type;

export const ChatMessageBody = NonBlankTrimmed.pipe(
  Schema.check(Schema.isMaxLength(4_000)),
  Schema.brand("ChatMessageBody"),
);
export type ChatMessageBody = typeof ChatMessageBody.Type;

export const ChatPresetName = NonBlankTrimmed.pipe(
  Schema.check(Schema.isMaxLength(80)),
  Schema.brand("ChatPresetName"),
);
export type ChatPresetName = typeof ChatPresetName.Type;

export const ChatPresetTemplate = NonBlankTrimmed.pipe(
  Schema.check(Schema.isMaxLength(4_000)),
  Schema.brand("ChatPresetTemplate"),
);
export type ChatPresetTemplate = typeof ChatPresetTemplate.Type;

const ChatPresetFieldName = NonBlankTrimmed.pipe(Schema.check(Schema.isMaxLength(60)));
const ChatPresetOption = NonBlankTrimmed.pipe(Schema.check(Schema.isMaxLength(120)));

export const ChatPresetField = Schema.Union([
  Schema.Struct({ name: ChatPresetFieldName, type: Schema.Literal("microphone") }),
  Schema.Struct({ name: ChatPresetFieldName, type: Schema.Literal("mix") }),
  Schema.Struct({ name: ChatPresetFieldName, type: Schema.Literal("text") }),
  Schema.Struct({ name: ChatPresetFieldName, type: Schema.Literal("number") }),
  Schema.Struct({
    name: ChatPresetFieldName,
    type: Schema.Literal("select"),
    options: Schema.Array(ChatPresetOption),
  }),
]);
export type ChatPresetField = typeof ChatPresetField.Type;

export const ChatPreset = Schema.Struct({
  id: ChatPresetId,
  showId: ShowId,
  name: ChatPresetName,
  template: ChatPresetTemplate,
  fields: Schema.Array(ChatPresetField),
  createdAt: Schema.DateTimeUtcFromString,
  updatedAt: Schema.DateTimeUtcFromString,
});
export type ChatPreset = typeof ChatPreset.Type;

export const ChatMessagePart = Schema.Union([
  Schema.Struct({ type: Schema.Literal("text"), text: Schema.String }),
  Schema.Struct({
    type: Schema.Literal("microphone"),
    id: MicrophoneId,
    number: MicrophoneNumber,
    color: Color,
    name: Schema.optional(Schema.String),
    text: Schema.String,
  }),
  Schema.Struct({
    type: Schema.Literal("mix"),
    id: MixId,
    number: MixNumber,
    color: Color,
    name: Schema.optional(Schema.String),
    text: Schema.String,
  }),
]);
export type ChatMessagePart = typeof ChatMessagePart.Type;

export const ChatMessage = Schema.Struct({
  id: ChatMessageId,
  sequence: ChatSequence,
  showId: ShowId,
  channelId: ChatChannelId,
  senderProfileId: ProfileId,
  body: ChatMessageBody,
  parts: Schema.optional(Schema.Array(ChatMessagePart)),
  sentAt: Schema.DateTimeUtcFromString,
});
export type ChatMessage = typeof ChatMessage.Type;

export const ChatChannel = Schema.Struct({
  id: ChatChannelId,
  showId: ShowId,
  name: ChatChannelName,
  createdAt: Schema.DateTimeUtcFromString,
  messages: Schema.Array(ChatMessage),
  messageCount: NonNegativeInt,
  incomingMessageCount: NonNegativeInt,
  unreadCount: NonNegativeInt,
  lastReadSequence: ChatSequence,
  earliestReplaySequence: ChatSequence,
  newestSequence: ChatSequence,
  notificationsEnabled: Schema.Boolean,
});
export type ChatChannel = typeof ChatChannel.Type;

export const ChatSnapshot = Schema.Struct({
  showId: ShowId,
  profileId: ProfileId,
  channels: Schema.Array(ChatChannel),
  presets: Schema.Array(ChatPreset),
});
export type ChatSnapshot = typeof ChatSnapshot.Type;

export const decodeChatChannelName = Schema.decodeUnknownEffect(ChatChannelName);
export const decodeChatMessageBody = Schema.decodeUnknownEffect(ChatMessageBody);
export const decodeChatPresetName = Schema.decodeUnknownEffect(ChatPresetName);
export const decodeChatPresetTemplate = Schema.decodeUnknownEffect(ChatPresetTemplate);
export const decodeChatPresetFields = Schema.decodeUnknownSync(Schema.Array(ChatPresetField));

const placeholderPattern = /{{\s*([A-Za-z][A-Za-z0-9_-]*)\s*}}/g;

export const chatPresetPlaceholderNames = (template: string): ReadonlyArray<string> => {
  const names: Array<string> = [];
  const seen = new Set<string>();
  for (const match of template.matchAll(placeholderPattern)) {
    const name = match[1]!;
    if (!seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  return names;
};

export const validateChatPresetDefinition = (input: {
  readonly template: string;
  readonly fields: ReadonlyArray<ChatPresetField>;
}): string | undefined => {
  const placeholders = chatPresetPlaceholderNames(input.template);
  if (placeholders.length === 0) return "Add at least one placeholder such as {{mic}}.";
  const fieldNames = input.fields.map((field) => field.name);
  if (new Set(fieldNames).size !== fieldNames.length)
    return "Each placeholder can only be defined once.";
  if (
    placeholders.length !== fieldNames.length ||
    placeholders.some((name) => !fieldNames.includes(name))
  )
    return "Every template placeholder needs exactly one field definition.";
  const invalidSelect = input.fields.find(
    (field) =>
      field.type === "select" &&
      (field.options.length === 0 ||
        new Set(field.options.map((option) => option.trim())).size !== field.options.length),
  );
  if (invalidSelect) return `Give {{${invalidSelect.name}}} at least one unique option.`;
  return undefined;
};

export const chatMessagePartsText = (parts: ReadonlyArray<ChatMessagePart>): string =>
  parts.map((part) => part.text).join("");

export const resolveChatPresetTemplate = (
  template: string,
  values: ReadonlyMap<string, ChatMessagePart>,
): { readonly body: string; readonly parts: ReadonlyArray<ChatMessagePart> } | undefined => {
  const parts: Array<ChatMessagePart> = [];
  let cursor = 0;
  for (const match of template.matchAll(placeholderPattern)) {
    const index = match.index;
    if (index > cursor) parts.push({ type: "text", text: template.slice(cursor, index) });
    const value = values.get(match[1]!);
    if (!value) return undefined;
    parts.push(value);
    cursor = index + match[0].length;
  }
  if (cursor < template.length) parts.push({ type: "text", text: template.slice(cursor) });
  if (parts.length === 0) return undefined;
  return { body: chatMessagePartsText(parts), parts };
};

const storedChatMessagePrefix = "__showtime_chat_v1__:";
const decodeChatMessageParts = Schema.decodeUnknownSync(Schema.Array(ChatMessagePart));

export const encodeStoredChatMessage = (
  body: ChatMessageBody,
  parts: ReadonlyArray<ChatMessagePart>,
): string => `${storedChatMessagePrefix}${JSON.stringify({ body, parts })}`;

export const decodeStoredChatMessage = (
  stored: string,
): { readonly body: string; readonly parts?: ReadonlyArray<ChatMessagePart> } => {
  if (!stored.startsWith(storedChatMessagePrefix)) return { body: stored };
  try {
    const parsed = JSON.parse(stored.slice(storedChatMessagePrefix.length)) as unknown;
    if (!parsed || typeof parsed !== "object") return { body: stored };
    const value = parsed as { readonly body?: unknown; readonly parts?: unknown };
    if (typeof value.body !== "string") return { body: stored };
    const parts = decodeChatMessageParts(value.parts);
    if (parts.length === 0 || chatMessagePartsText(parts) !== value.body) return { body: stored };
    return { body: value.body, parts };
  } catch {
    return { body: stored };
  }
};
