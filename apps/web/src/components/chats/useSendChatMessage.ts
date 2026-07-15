import * as React from "react";
import { useAtomSet } from "@effect/atom-react";
import { Exit } from "effect";
import {
  chatsSyncKey,
  type ChatChannelId,
  type ChatMessageBody,
  type ChatMessagePart,
  type ProfileId,
  type ShowId,
} from "@showtime/contracts";
import { chatAtoms, rpcErrorMessageFromCause } from "@/client";

export function useSendChatMessage(showId: ShowId, profileId: ProfileId, channelId: ChatChannelId) {
  const send = useAtomSet(chatAtoms(showId, profileId).send, { mode: "promiseExit" });
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string>();

  const sendMessage = React.useCallback(
    async (
      messageBody: string,
      parts?: ReadonlyArray<ChatMessagePart>,
    ): Promise<string | undefined> => {
      const trimmed = messageBody.trim();
      if (!trimmed || sending) return "A message is already being sent.";
      setSending(true);
      setError(undefined);
      const exit = await send({
        payload: {
          showId,
          channelId,
          senderProfileId: profileId,
          body: trimmed as ChatMessageBody,
          ...(parts === undefined ? {} : { parts }),
        },
        reactivityKeys: chatsSyncKey(showId),
      });
      const nextError = Exit.isFailure(exit) ? rpcErrorMessageFromCause(exit.cause) : undefined;
      if (nextError) setError(nextError);
      setSending(false);
      return nextError;
    },
    [channelId, profileId, send, sending, showId],
  );

  return { sendMessage, sending, error } as const;
}
