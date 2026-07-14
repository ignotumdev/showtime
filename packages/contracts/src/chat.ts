import { Schema } from "effect";
import { idAlphabet, idSuffixLength } from "./ids.js";
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

export const ChatMessage = Schema.Struct({
  id: ChatMessageId,
  sequence: ChatSequence,
  showId: ShowId,
  channelId: ChatChannelId,
  senderProfileId: ProfileId,
  body: ChatMessageBody,
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
});
export type ChatSnapshot = typeof ChatSnapshot.Type;

export const decodeChatChannelName = Schema.decodeUnknownEffect(ChatChannelName);
export const decodeChatMessageBody = Schema.decodeUnknownEffect(ChatMessageBody);
