import type {
  ChatChannel,
  ChatChannelId,
  ChatMessage,
  ChatPresetAnswer,
  ChatSequence,
  ProfileId,
} from "@showtime/contracts";

export type AnswerRequest = ChatMessage & { readonly answer: ChatPresetAnswer };

export type ChatAnswerRequestSequences = ReadonlyMap<ChatChannelId, ChatSequence>;

export const reconcileChatAnswerRequests = ({
  queued,
  incoming,
  channelIds,
}: {
  readonly queued: ReadonlyArray<AnswerRequest>;
  readonly incoming: ReadonlyArray<AnswerRequest>;
  readonly channelIds: ReadonlySet<ChatChannelId>;
}): ReadonlyArray<AnswerRequest> => {
  const next = queued.filter((request) => channelIds.has(request.channelId));
  for (const request of incoming) {
    if (channelIds.has(request.channelId) && !next.some((item) => item.id === request.id)) {
      next.push(request);
    }
  }
  return next.length === queued.length && next.every((request, index) => request === queued[index])
    ? queued
    : next;
};

const isAnswerRequest = (message: ChatMessage): message is AnswerRequest =>
  message.answer !== undefined;

export const isPendingChatAnswerRequest = (
  channel: ChatChannel,
  message: ChatMessage,
  profileId: ProfileId,
): message is AnswerRequest =>
  message.senderProfileId !== profileId &&
  isAnswerRequest(message) &&
  !channel.messages.some(
    (reply) => reply.replyToMessageId === message.id && reply.senderProfileId === profileId,
  );

export const planChatAnswerRequests = ({
  channels,
  profileId,
  previousSequences,
  shouldPrompt,
}: {
  readonly channels: ReadonlyArray<ChatChannel>;
  readonly profileId: ProfileId;
  readonly previousSequences: ChatAnswerRequestSequences | undefined;
  readonly shouldPrompt: boolean;
}): {
  readonly requests: ReadonlyArray<AnswerRequest>;
  readonly sequences: ChatAnswerRequestSequences;
} => {
  const requests: Array<AnswerRequest> = [];
  const sequences = new Map<ChatChannelId, ChatSequence>();

  for (const channel of channels) {
    const previousSequence = previousSequences?.get(channel.id) ?? channel.lastReadSequence;
    sequences.set(channel.id, channel.newestSequence);
    if (!shouldPrompt) continue;

    requests.push(
      ...channel.messages.filter(
        (message): message is AnswerRequest =>
          message.sequence > previousSequence &&
          isPendingChatAnswerRequest(channel, message, profileId),
      ),
    );
  }

  return { requests, sequences };
};
