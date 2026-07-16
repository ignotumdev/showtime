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

export const ChatPresetAnswerContext = Schema.Struct({
  name: ChatPresetFieldName,
  part: ChatMessagePart,
});
export type ChatPresetAnswerContext = typeof ChatPresetAnswerContext.Type;

export const ChatPresetAnswer = Schema.Struct({
  template: ChatPresetTemplate,
  fields: Schema.Array(ChatPresetField),
  context: Schema.optional(Schema.Array(ChatPresetAnswerContext)),
});
export type ChatPresetAnswer = typeof ChatPresetAnswer.Type;

export const ChatPreset = Schema.Struct({
  id: ChatPresetId,
  showId: ShowId,
  name: ChatPresetName,
  template: ChatPresetTemplate,
  fields: Schema.Array(ChatPresetField),
  answer: Schema.optional(ChatPresetAnswer),
  createdAt: Schema.DateTimeUtcFromString,
  updatedAt: Schema.DateTimeUtcFromString,
});
export type ChatPreset = typeof ChatPreset.Type;

export const ChatMessage = Schema.Struct({
  id: ChatMessageId,
  sequence: ChatSequence,
  showId: ShowId,
  channelId: ChatChannelId,
  senderProfileId: ProfileId,
  body: ChatMessageBody,
  parts: Schema.optional(Schema.Array(ChatMessagePart)),
  answer: Schema.optional(ChatPresetAnswer),
  replyToMessageId: Schema.optional(ChatMessageId),
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
export const decodeChatPresetAnswer = Schema.decodeUnknownSync(ChatPresetAnswer);

const placeholderPattern = /{{\s*([A-Za-z][A-Za-z0-9_-]*)\s*}}/g;
const singlePlaceholderPattern = /^{{\s*[A-Za-z][A-Za-z0-9_-]*\s*}}/;

export const chatPresetTemplateIsSinglePlaceholder = (template: string): boolean => {
  const match = singlePlaceholderPattern.exec(template);
  return match !== null && match[0].length === template.length;
};

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

const validateChatPresetDefinitionWithContext = (
  input: {
    readonly template: string;
    readonly fields: ReadonlyArray<ChatPresetField>;
  },
  contextNames: ReadonlySet<string>,
): string | undefined => {
  const placeholders = chatPresetPlaceholderNames(input.template);
  if (placeholders.length === 0) return "Add at least one placeholder such as {{mic}}.";
  const fieldNames = input.fields.map((field) => field.name);
  if (new Set(fieldNames).size !== fieldNames.length)
    return "Each placeholder can only be defined once.";
  const inputPlaceholders = placeholders.filter(
    (name) => !contextNames.has(name) || fieldNames.includes(name),
  );
  if (
    inputPlaceholders.length !== fieldNames.length ||
    inputPlaceholders.some((name) => !fieldNames.includes(name))
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

export const validateChatPresetDefinition = (input: {
  readonly template: string;
  readonly fields: ReadonlyArray<ChatPresetField>;
}): string | undefined => validateChatPresetDefinitionWithContext(input, new Set());

export const validateChatPresetAnswerDefinition = (
  answer: {
    readonly template: string;
    readonly fields: ReadonlyArray<ChatPresetField>;
  },
  messageFieldNames: ReadonlyArray<string>,
): string | undefined => {
  if (answer.fields.length === 0)
    return "Add at least one answer placeholder for recipients to fill.";
  if (new Set(messageFieldNames).size !== messageFieldNames.length)
    return "Each inherited message placeholder can only be supplied once.";
  return validateChatPresetDefinitionWithContext(answer, new Set(messageFieldNames));
};

export const bindChatPresetAnswer = (
  answer: ChatPresetAnswer,
  messageValues: ReadonlyMap<string, ChatMessagePart>,
): ChatPresetAnswer | undefined => {
  const answerFieldNames = new Set(answer.fields.map((field) => field.name));
  const context: Array<ChatPresetAnswerContext> = [];
  for (const name of chatPresetPlaceholderNames(answer.template)) {
    if (answerFieldNames.has(name)) continue;
    const part = messageValues.get(name);
    if (!part) return undefined;
    context.push({ name, part });
  }
  const bound = {
    template: answer.template,
    fields: answer.fields,
    ...(context.length > 0 ? { context } : {}),
  } satisfies ChatPresetAnswer;
  return validateChatPresetAnswerDefinition(
    bound,
    context.map((item) => item.name),
  )
    ? undefined
    : bound;
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

const legacyStoredChatMessagePrefix = "__showtime_chat_v1__:";
const previousStoredChatMessagePrefix = "__showtime_chat_v2__:";
const storedChatMessagePrefix = "__showtime_chat_v3__:";
const decodeChatMessageParts = Schema.decodeUnknownSync(Schema.Array(ChatMessagePart));
const decodeChatMessageId = Schema.decodeUnknownSync(ChatMessageId);
const decodeStoredChatPresetAnswer = (input: unknown) => {
  const answer = decodeChatPresetAnswer(input);
  const validationError = validateChatPresetAnswerDefinition(
    answer,
    answer.context?.map((item) => item.name) ?? [],
  );
  if (validationError) throw new Error(validationError);
  return answer;
};

export const encodeStoredChatMessage = (
  body: ChatMessageBody,
  options: {
    readonly parts?: ReadonlyArray<ChatMessagePart>;
    readonly answer?: ChatPresetAnswer;
    readonly replyToMessageId?: ChatMessageId;
  } = {},
): string =>
  `${storedChatMessagePrefix}${JSON.stringify({
    kind: options.parts?.length ? "rich" : "plain",
    body,
    ...(options.parts?.length ? { parts: options.parts } : {}),
    ...(options.answer ? { answer: options.answer } : {}),
    ...(options.replyToMessageId ? { replyToMessageId: options.replyToMessageId } : {}),
  })}`;

export const decodeStoredChatMessage = (
  stored: string,
): {
  readonly body: string;
  readonly parts?: ReadonlyArray<ChatMessagePart>;
  readonly answer?: ChatPresetAnswer;
  readonly replyToMessageId?: ChatMessageId;
} => {
  const isCurrentEnvelope = stored.startsWith(storedChatMessagePrefix);
  const isPreviousEnvelope = stored.startsWith(previousStoredChatMessagePrefix);
  const isLegacyEnvelope = stored.startsWith(legacyStoredChatMessagePrefix);
  if (!isCurrentEnvelope && !isPreviousEnvelope && !isLegacyEnvelope) return { body: stored };
  try {
    const prefix = isCurrentEnvelope
      ? storedChatMessagePrefix
      : isPreviousEnvelope
        ? previousStoredChatMessagePrefix
        : legacyStoredChatMessagePrefix;
    const parsed = JSON.parse(stored.slice(prefix.length)) as unknown;
    if (!parsed || typeof parsed !== "object") return { body: stored };
    const value = parsed as {
      readonly kind?: unknown;
      readonly body?: unknown;
      readonly parts?: unknown;
      readonly answer?: unknown;
      readonly replyToMessageId?: unknown;
    };
    if (typeof value.body !== "string") return { body: stored };
    if (!isLegacyEnvelope && value.kind !== "plain" && value.kind !== "rich")
      return { body: stored };
    const metadata = isCurrentEnvelope
      ? {
          ...(value.answer === undefined
            ? {}
            : { answer: decodeStoredChatPresetAnswer(value.answer) }),
          ...(value.replyToMessageId === undefined
            ? {}
            : { replyToMessageId: decodeChatMessageId(value.replyToMessageId) }),
        }
      : {};
    if (!isLegacyEnvelope && value.kind === "plain") return { body: value.body, ...metadata };
    const parts = decodeChatMessageParts(value.parts);
    if (parts.length === 0 || chatMessagePartsText(parts) !== value.body) return { body: stored };
    return { body: value.body, parts, ...metadata };
  } catch {
    return { body: stored };
  }
};
