import * as React from "react";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { DateTime, Exit } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import { MessageScroller, useMessageScrollerScrollable } from "@shadcn/react/message-scroller";
import {
  chatsSyncKey,
  type ChatChannel,
  type ChatChannelId,
  type ChatChannelName,
  type ChatPreset,
  type Profile,
  type ProfileId,
  type ShowId,
} from "@showtime/contracts";
import {
  ArrowUpIcon,
  BellIcon,
  BellOffIcon,
  HashIcon,
  MoreHorizontalIcon,
  LibraryIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { chatAtoms, profileAtoms, rpcErrorMessageFromCause } from "@/client";
import { setChatPresence } from "@/chats/ChatPresence";
import { ProfileAvatar } from "@/components/profiles/ProfileAvatar";
import { ChatMessageBody as RichChatMessageBody } from "@/components/chats/ChatMessageBody";
import { ChatPresetAnswerForm } from "@/components/chats/ChatPresetAnswer";
import { ChatPresetDialog } from "@/components/chats/ChatPresetDialog";
import { useSendChatMessage } from "@/components/chats/useSendChatMessage";
import { ProfileSwitcher } from "@/components/profiles/ProfileSwitcher";
import { formatClientTime } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageHeader,
} from "@/components/ui/message";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useSelectedProfile } from "@/profiles";

export function ChatWorkspace({
  showId,
  active = true,
  compact = false,
  requestedChannelId,
  onSelectedChannelChange,
}: {
  readonly showId: ShowId;
  readonly active?: boolean;
  readonly compact?: boolean;
  readonly requestedChannelId?: ChatChannelId;
  readonly onSelectedChannelChange?: (channelId: ChatChannelId) => void;
}) {
  const profilesResult = useAtomValue(profileAtoms.state);
  const profileState = AsyncResult.isSuccess(profilesResult) ? profilesResult.value : undefined;
  const { selected } = useSelectedProfile(profileState);

  if (!selected || !profileState) {
    return (
      <div className="grid h-full min-h-72 place-content-center">
        <Spinner />
      </div>
    );
  }

  return (
    <ProfileChatWorkspace
      key={selected.id}
      showId={showId}
      active={active}
      compact={compact}
      profile={selected}
      profiles={profileState.profiles}
      requestedChannelId={requestedChannelId}
      onSelectedChannelChange={onSelectedChannelChange}
    />
  );
}

function ProfileChatWorkspace({
  showId,
  active,
  compact,
  profile,
  profiles,
  requestedChannelId,
  onSelectedChannelChange,
}: {
  readonly showId: ShowId;
  readonly active: boolean;
  readonly compact: boolean;
  readonly profile: Profile;
  readonly profiles: ReadonlyArray<Profile>;
  readonly requestedChannelId?: ChatChannelId;
  readonly onSelectedChannelChange?: (channelId: ChatChannelId) => void;
}) {
  const atoms = chatAtoms(showId, profile.id);
  const result = useAtomValue(atoms.state);
  const [internalSelectedChannelId, setInternalSelectedChannelId] = React.useState<ChatChannelId>();
  const snapshot = AsyncResult.isSuccess(result) ? result.value : undefined;
  const selectedChannelId = requestedChannelId ?? internalSelectedChannelId;
  const selectedChannel =
    snapshot?.channels.find((channel) => channel.id === selectedChannelId) ?? snapshot?.channels[0];
  const selectChannel = React.useCallback(
    (channelId: ChatChannelId) => {
      setInternalSelectedChannelId(channelId);
      onSelectedChannelChange?.(channelId);
    },
    [onSelectedChannelChange],
  );

  if (!snapshot || !selectedChannel) {
    return (
      <div className="grid h-full min-h-72 place-content-center gap-2 text-center text-sm text-muted-foreground">
        {AsyncResult.isFailure(result) ? "Chat could not be loaded." : <Spinner />}
      </div>
    );
  }

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border bg-background">
      <ChannelTabs
        showId={showId}
        profileId={profile.id}
        channels={snapshot.channels}
        selectedChannel={selectedChannel}
        onSelect={selectChannel}
        trailing={compact ? null : <ProfileSwitcher variant="avatar" className="md:hidden" />}
      />
      <Conversation
        key={selectedChannel.id}
        showId={showId}
        profile={profile}
        profiles={profiles}
        channel={selectedChannel}
        presets={snapshot.presets}
        active={active}
      />
    </section>
  );
}

function ChannelTabs({
  showId,
  profileId,
  channels,
  selectedChannel,
  onSelect,
  trailing,
}: {
  readonly showId: ShowId;
  readonly profileId: ProfileId;
  readonly channels: ReadonlyArray<ChatChannel>;
  readonly selectedChannel: ChatChannel;
  readonly onSelect: (id: ChatChannelId) => void;
  readonly trailing: React.ReactNode;
}) {
  const atoms = chatAtoms(showId, profileId);
  const createChannel = useAtomSet(atoms.createChannel, { mode: "promiseExit" });
  const renameChannel = useAtomSet(atoms.renameChannel, { mode: "promiseExit" });
  const deleteChannel = useAtomSet(atoms.deleteChannel, { mode: "promiseExit" });
  const setNotifications = useAtomSet(atoms.setNotifications, { mode: "promiseExit" });
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [renameTarget, setRenameTarget] = React.useState<
    Pick<ChatChannel, "id" | "name"> | undefined
  >();
  const [deleteTarget, setDeleteTarget] = React.useState<
    Pick<ChatChannel, "id" | "name"> | undefined
  >();
  const [name, setName] = React.useState("");
  const [renameName, setRenameName] = React.useState<string>(selectedChannel.name);
  const [adding, setAdding] = React.useState(false);
  const [renaming, setRenaming] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const mutationOptions = { reactivityKeys: chatsSyncKey(showId) } as const;

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || adding) return;
    setAdding(true);
    setError(undefined);
    const exit = await createChannel({
      payload: { showId, name: trimmed as ChatChannelName },
      ...mutationOptions,
    });
    if (Exit.isFailure(exit)) setError(rpcErrorMessageFromCause(exit.cause));
    else {
      setName("");
      setDialogOpen(false);
      onSelect(exit.value.id);
    }
    setAdding(false);
  };

  const toggleNotifications = () => {
    setError(undefined);
    void setNotifications({
      payload: {
        showId,
        channelId: selectedChannel.id,
        profileId,
        enabled: !selectedChannel.notificationsEnabled,
      },
      ...mutationOptions,
    }).then((exit) => {
      if (Exit.isFailure(exit)) setError(rpcErrorMessageFromCause(exit.cause));
    });
  };

  const openRenameDialog = () => {
    setRenameName(selectedChannel.name);
    setRenameTarget({ id: selectedChannel.id, name: selectedChannel.name });
    setError(undefined);
  };

  const rename = async (event: React.FormEvent) => {
    event.preventDefault();
    const target = renameTarget;
    const trimmed = renameName.trim();
    if (!target || !trimmed || renaming || trimmed === target.name) return;
    setRenaming(true);
    setError(undefined);
    const exit = await renameChannel({
      payload: { showId, channelId: target.id, name: trimmed as ChatChannelName },
      ...mutationOptions,
    });
    if (Exit.isFailure(exit)) setError(rpcErrorMessageFromCause(exit.cause));
    else setRenameTarget(undefined);
    setRenaming(false);
  };

  const remove = async () => {
    const target = deleteTarget;
    if (!target || deleting || channels.length === 1) return;
    setDeleting(true);
    setError(undefined);
    try {
      const exit = await deleteChannel({
        payload: { showId, channelId: target.id },
        ...mutationOptions,
      });
      if (Exit.isFailure(exit)) setError(rpcErrorMessageFromCause(exit.cause));
      else setDeleteTarget(undefined);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-2">
        <div className="min-w-0 flex-1 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <ButtonGroup aria-label="Chat channels" className="min-w-max">
            {channels.map((channel, index) => {
              const selected = channel.id === selectedChannel.id;
              return (
                <div key={channel.id} className="relative flex">
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "rounded-none border-l-0 pr-9",
                      index === 0 && "rounded-l-lg border-l",
                      selected &&
                        "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] dark:bg-secondary dark:text-secondary-foreground dark:hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]",
                    )}
                    onClick={() => onSelect(channel.id)}
                  >
                    <HashIcon />
                    <span className="max-w-40 truncate">{channel.name}</span>
                    {!channel.notificationsEnabled && (
                      <BellOffIcon className="text-muted-foreground" />
                    )}
                    {channel.unreadCount > 0 && <Badge>{channel.unreadCount}</Badge>}
                  </Button>
                  {selected && (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="absolute top-0 right-0 rounded-none"
                            aria-label={`Options for ${selectedChannel.name}`}
                          />
                        }
                      >
                        <MoreHorizontalIcon />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={openRenameDialog}>
                          <PencilIcon />
                          Rename channel
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={toggleNotifications}>
                          {selectedChannel.notificationsEnabled ? <BellOffIcon /> : <BellIcon />}
                          {selectedChannel.notificationsEnabled ? "Mute channel" : "Unmute channel"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          disabled={channels.length === 1}
                          onClick={() => {
                            setError(undefined);
                            setDeleteTarget({
                              id: selectedChannel.id,
                              name: selectedChannel.name,
                            });
                          }}
                        >
                          <Trash2Icon />
                          Delete channel
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              );
            })}
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label="Add channel"
              onClick={() => {
                setError(undefined);
                setDialogOpen(true);
              }}
            >
              <PlusIcon />
            </Button>
          </ButtonGroup>
        </div>
        {trailing}
      </header>
      {error && !dialogOpen && !renameTarget && !deleteTarget && (
        <p role="alert" className="shrink-0 border-b px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New channel</DialogTitle>
            <DialogDescription>Create another conversation for this show.</DialogDescription>
          </DialogHeader>
          <form className="flex gap-2" onSubmit={add}>
            <Input
              autoFocus
              value={name}
              maxLength={60}
              placeholder="Channel name"
              aria-label="New channel name"
              onChange={(event) => setName(event.currentTarget.value)}
            />
            <Button type="submit" disabled={adding || !name.trim()}>
              {adding ? <Spinner /> : "Create"}
            </Button>
          </form>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={renameTarget !== undefined}
        onOpenChange={(open) => {
          if (!open && !renaming) setRenameTarget(undefined);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename channel</DialogTitle>
            <DialogDescription>Choose a new name for #{renameTarget?.name}.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={rename}>
            <Input
              autoFocus
              value={renameName}
              maxLength={60}
              aria-label="Channel name"
              onChange={(event) => setRenameName(event.currentTarget.value)}
            />
            {error && (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" disabled={renaming} />}>
                Cancel
              </DialogClose>
              <Button
                type="submit"
                disabled={
                  renaming || !renameName.trim() || renameName.trim() === renameTarget?.name
                }
              >
                {renaming ? <Spinner /> : "Rename"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={deleteTarget !== undefined}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(undefined);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete channel?</DialogTitle>
            <DialogDescription>
              This will permanently delete #{deleteTarget?.name} and all of its messages. This
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={deleting} />}>
              Cancel
            </DialogClose>
            <Button type="button" variant="destructive" disabled={deleting} onClick={remove}>
              <Trash2Icon />
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Conversation({
  showId,
  profile,
  profiles,
  channel,
  presets,
  active,
}: {
  readonly showId: ShowId;
  readonly profile: Profile;
  readonly profiles: ReadonlyArray<Profile>;
  readonly channel: ChatChannel;
  readonly presets: ReadonlyArray<ChatPreset>;
  readonly active: boolean;
}) {
  return (
    <MessageScroller.Provider autoScroll defaultScrollPosition="end" scrollEdgeThreshold={24}>
      <MessageScroller.Root className="relative flex min-h-0 flex-1 flex-col">
        <ScrollArea
          className="min-h-0 flex-1"
          viewportRender={
            <MessageScroller.Viewport className="min-h-0 flex-1 overflow-y-auto overscroll-contain" />
          }
        >
          <MessageScroller.Content className="flex min-h-full flex-col justify-end gap-4 p-3 sm:p-4">
            {channel.messages.length === 0 && (
              <div className="my-auto text-center text-sm text-muted-foreground">
                No messages yet. Start the conversation.
              </div>
            )}
            {channel.messages.map((message) => {
              const sender = profiles.find((item) => item.id === message.senderProfileId);
              const mine = message.senderProfileId === profile.id;
              const request = message.replyToMessageId
                ? channel.messages.find((item) => item.id === message.replyToMessageId)
                : undefined;
              const answered = channel.messages.some(
                (item) =>
                  item.replyToMessageId === message.id && item.senderProfileId === profile.id,
              );
              return (
                <MessageScroller.Item key={message.id} messageId={message.id}>
                  <Message align={mine ? "end" : "start"}>
                    <MessageAvatar>
                      <ProfileAvatar
                        name={sender?.name ?? "Deleted profile"}
                        color={sender?.color}
                      />
                    </MessageAvatar>
                    <MessageContent>
                      <MessageHeader>{sender?.name ?? "Deleted profile"}</MessageHeader>
                      {request && (
                        <p className="max-w-72 truncate text-xs text-muted-foreground">
                          Answer to: {request.body}
                        </p>
                      )}
                      <Bubble variant={mine ? "default" : "secondary"}>
                        <BubbleContent className="whitespace-pre-wrap">
                          <RichChatMessageBody body={message.body} parts={message.parts} />
                        </BubbleContent>
                      </Bubble>
                      {message.answer && !mine && (
                        <div className="mt-2 space-y-3 rounded-lg border p-3">
                          <p className="text-sm font-medium">Answer</p>
                          <ChatPresetAnswerForm
                            showId={showId}
                            profileId={profile.id}
                            request={{ ...message, answer: message.answer }}
                            answered={answered}
                          />
                        </div>
                      )}
                      <MessageFooter>
                        {formatClientTime(DateTime.toDateUtc(message.sentAt))}
                      </MessageFooter>
                    </MessageContent>
                  </Message>
                </MessageScroller.Item>
              );
            })}
          </MessageScroller.Content>
        </ScrollArea>
        <ReadTracker showId={showId} profileId={profile.id} channel={channel} active={active} />
        <Composer showId={showId} profileId={profile.id} channelId={channel.id} presets={presets} />
      </MessageScroller.Root>
    </MessageScroller.Provider>
  );
}

function ReadTracker({
  showId,
  profileId,
  channel,
  active,
}: {
  readonly showId: ShowId;
  readonly profileId: ProfileId;
  readonly channel: ChatChannel;
  readonly active: boolean;
}) {
  const { end: canScrollToEnd } = useMessageScrollerScrollable();
  const markRead = useAtomSet(chatAtoms(showId, profileId).markRead, { mode: "promiseExit" });
  const atBottom = !canScrollToEnd;
  const lastMarked = React.useRef(channel.lastReadSequence);

  React.useEffect(() => {
    setChatPresence(active ? { showId, channelId: channel.id, profileId, atBottom } : undefined);
    return () => setChatPresence(undefined);
  }, [active, atBottom, channel.id, profileId, showId]);

  React.useEffect(() => {
    if (!active || !atBottom || channel.newestSequence <= lastMarked.current) return;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let cancelRetryWait: (() => void) | undefined;

    const markNewestRead = async () => {
      let retryDelay = 250;
      while (!cancelled && channel.newestSequence > lastMarked.current) {
        const exit = await markRead({
          payload: {
            showId,
            channelId: channel.id,
            profileId,
            sequence: channel.newestSequence,
          },
          reactivityKeys: chatsSyncKey(showId),
        });
        if (Exit.isSuccess(exit)) {
          if (channel.newestSequence > lastMarked.current)
            lastMarked.current = channel.newestSequence;
          return;
        }
        await new Promise<void>((resolve) => {
          cancelRetryWait = resolve;
          retryTimer = setTimeout(() => {
            retryTimer = undefined;
            cancelRetryWait = undefined;
            resolve();
          }, retryDelay);
        });
        retryDelay = Math.min(retryDelay * 2, 5_000);
      }
    };

    void markNewestRead();
    return () => {
      cancelled = true;
      if (retryTimer !== undefined) clearTimeout(retryTimer);
      cancelRetryWait?.();
    };
  }, [active, atBottom, channel.id, channel.newestSequence, markRead, profileId, showId]);
  return null;
}

function resizeComposer(textarea: HTMLTextAreaElement) {
  textarea.style.height = "auto";
  const style = window.getComputedStyle(textarea);
  const lineHeight = Number.parseFloat(style.lineHeight) || 20;
  const padding = Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom);
  textarea.style.height = `${Math.min(textarea.scrollHeight, lineHeight * 5 + padding)}px`;
}

function Composer({
  showId,
  profileId,
  channelId,
  presets,
}: {
  readonly showId: ShowId;
  readonly profileId: ProfileId;
  readonly channelId: ChatChannelId;
  readonly presets: ReadonlyArray<ChatPreset>;
}) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = React.useState("");
  const [presetsOpen, setPresetsOpen] = React.useState(false);
  const { sendMessage, sending, error } = useSendChatMessage(showId, profileId, channelId);

  React.useLayoutEffect(() => {
    if (textareaRef.current) resizeComposer(textareaRef.current);
  }, [body]);

  const submit = async () => {
    const submittedDraft = body;
    const nextError = await sendMessage(submittedDraft);
    if (!nextError) setBody((current) => (current === submittedDraft ? "" : current));
  };

  return (
    <div className="shrink-0 border-t px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-3 sm:pt-3 sm:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <InputGroup>
        <InputGroupAddon align="inline-start">
          <InputGroupButton
            size="icon-sm"
            aria-label="Open message presets"
            title="Message presets"
            onClick={() => setPresetsOpen(true)}
          >
            <LibraryIcon />
          </InputGroupButton>
        </InputGroupAddon>
        <InputGroupTextarea
          ref={textareaRef}
          value={body}
          maxLength={4_000}
          rows={1}
          placeholder="Write a message"
          aria-label="Message"
          className="min-h-8 overflow-y-auto"
          onChange={(event) => {
            setBody(event.currentTarget.value);
            resizeComposer(event.currentTarget);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-sm"
            variant="default"
            className="rounded-full"
            aria-label="Send message"
            disabled={sending || !body.trim()}
            onClick={submit}
          >
            {sending ? <Spinner /> : <ArrowUpIcon />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      {error && (
        <p role="alert" className="pt-2 text-xs text-destructive">
          {error}
        </p>
      )}
      <ChatPresetDialog
        open={presetsOpen}
        onOpenChange={setPresetsOpen}
        showId={showId}
        profileId={profileId}
        presets={presets}
        onSend={(presetBody, parts, answer) =>
          sendMessage(presetBody, parts, answer ? { answer } : undefined)
        }
      />
    </div>
  );
}
