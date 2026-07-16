import * as React from "react";
import type { ChatMessage, ProfileId, ShowId } from "@showtime/contracts";
import { ArrowUpIcon, CheckIcon } from "lucide-react";
import {
  ChatPresetFieldInputs,
  initialChatPresetValues,
  resolveChatPresetDefinition,
  useChatPresetResources,
} from "@/components/chats/ChatPresetFields";
import { ChatMessageBody } from "@/components/chats/ChatMessageBody";
import { useSendChatMessage } from "@/components/chats/useSendChatMessage";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

export function ChatPresetAnswerForm({
  showId,
  profileId,
  request,
  answered,
  onAnswered,
}: {
  readonly showId: ShowId;
  readonly profileId: ProfileId;
  readonly request: ChatMessage & { readonly answer: NonNullable<ChatMessage["answer"]> };
  readonly answered: boolean;
  readonly onAnswered?: () => void;
}) {
  if (answered) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <CheckIcon className="size-4" /> Answer sent
      </p>
    );
  }
  return (
    <PendingChatPresetAnswerForm
      showId={showId}
      profileId={profileId}
      request={request}
      onAnswered={onAnswered}
    />
  );
}

function PendingChatPresetAnswerForm({
  showId,
  profileId,
  request,
  onAnswered,
}: {
  readonly showId: ShowId;
  readonly profileId: ProfileId;
  readonly request: ChatMessage & { readonly answer: NonNullable<ChatMessage["answer"]> };
  readonly onAnswered?: () => void;
}) {
  const { microphones, mixes } = useChatPresetResources(showId);
  const [values, setValues] = React.useState<Record<string, string>>(() =>
    initialChatPresetValues(request.answer.fields, microphones, mixes),
  );
  const { sendMessage, sending, error } = useSendChatMessage(showId, profileId, request.channelId);

  React.useEffect(() => {
    setValues((current) => {
      const defaults = initialChatPresetValues(request.answer.fields, microphones, mixes);
      return Object.fromEntries(
        Object.entries(defaults).map(([name, value]) => [name, current[name] || value]),
      );
    });
  }, [microphones, mixes, request.answer.fields]);

  const resolved = resolveChatPresetDefinition(request.answer, values, microphones, mixes);
  const setValue = (name: string, value: string) =>
    setValues((current) => ({ ...current, [name]: value }));
  const submit = async () => {
    if (!resolved || sending) return;
    const nextError = await sendMessage(resolved.body, resolved.parts, {
      replyToMessageId: request.id,
    });
    if (!nextError) onAnswered?.();
  };

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <ChatPresetFieldInputs
        fields={request.answer.fields}
        values={values}
        microphones={microphones}
        mixes={mixes}
        onValueChange={setValue}
      />
      {resolved && (
        <div className="rounded-lg border bg-muted/40 p-3 text-sm whitespace-pre-wrap">
          <ChatMessageBody body={resolved.body} parts={resolved.parts} />
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={!resolved || sending}>
          {sending ? <Spinner /> : <ArrowUpIcon />} Send answer
        </Button>
      </div>
    </form>
  );
}

export function ChatPresetAnswerDialog({
  open,
  onOpenChange,
  showId,
  profileId,
  request,
  senderName,
  answered,
  onAnswered,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly showId: ShowId;
  readonly profileId: ProfileId;
  readonly request:
    | (ChatMessage & { readonly answer: NonNullable<ChatMessage["answer"]> })
    | undefined;
  readonly senderName: string;
  readonly answered: boolean;
  readonly onAnswered: () => void;
}) {
  return (
    <Dialog open={open && Boolean(request)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        {request && (
          <>
            <DialogHeader>
              <DialogTitle>Answer {senderName}</DialogTitle>
              <DialogDescription>A message is waiting for your response.</DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border bg-muted/40 p-3 text-sm whitespace-pre-wrap">
              <ChatMessageBody body={request.body} parts={request.parts} />
            </div>
            <ChatPresetAnswerForm
              key={request.id}
              showId={showId}
              profileId={profileId}
              request={request}
              answered={answered}
              onAnswered={onAnswered}
            />
            {answered && (
              <DialogFooter>
                <Button type="button" onClick={() => onOpenChange(false)}>
                  Done
                </Button>
              </DialogFooter>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
