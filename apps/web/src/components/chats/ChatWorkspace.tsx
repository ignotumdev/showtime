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
  type ChatMessageBody,
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
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { chatAtoms, profileAtoms, rpcErrorMessageFromCause } from "@/client";
import { setChatPresence } from "@/chats/ChatPresence";
import { ProfileAvatar } from "@/components/profiles/ProfileAvatar";
import { ProfileSwitcher } from "@/components/profiles/ProfileSwitcher";
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
  const [selectedChannelId, setSelectedChannelId] = React.useState<ChatChannelId | undefined>(
    requestedChannelId,
  );
  const snapshot = AsyncResult.isSuccess(result) ? result.value : undefined;
  const selectedChannel =
    snapshot?.channels.find((channel) => channel.id === selectedChannelId) ?? snapshot?.channels[0];
  const selectChannel = React.useCallback(
    (channelId: ChatChannelId) => {
      setSelectedChannelId(channelId);
      onSelectedChannelChange?.(channelId);
    },
    [onSelectedChannelChange],
  );

  React.useEffect(() => {
    if (selectedChannel && selectedChannel.id !== selectedChannelId)
      selectChannel(selectedChannel.id);
  }, [selectChannel, selectedChannel, selectedChannelId]);

  React.useEffect(() => {
    if (
      requestedChannelId &&
      snapshot?.channels.some((channel) => channel.id === requestedChannelId)
    )
      selectChannel(requestedChannelId);
  }, [requestedChannelId, selectChannel, snapshot?.channels]);

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
  const [renameDialogOpen, setRenameDialogOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
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
    setError(undefined);
    setRenameDialogOpen(true);
  };

  const rename = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = renameName.trim();
    if (!trimmed || renaming || trimmed === selectedChannel.name) return;
    setRenaming(true);
    setError(undefined);
    const exit = await renameChannel({
      payload: { showId, channelId: selectedChannel.id, name: trimmed as ChatChannelName },
      ...mutationOptions,
    });
    if (Exit.isFailure(exit)) setError(rpcErrorMessageFromCause(exit.cause));
    else setRenameDialogOpen(false);
    setRenaming(false);
  };

  const remove = async () => {
    if (deleting || channels.length === 1) return;
    setDeleting(true);
    setError(undefined);
    const exit = await deleteChannel({
      payload: { showId, channelId: selectedChannel.id },
      ...mutationOptions,
    });
    if (Exit.isFailure(exit)) setError(rpcErrorMessageFromCause(exit.cause));
    else setDeleteDialogOpen(false);
    setDeleting(false);
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
                            setDeleteDialogOpen(true);
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
      {error && !dialogOpen && !renameDialogOpen && !deleteDialogOpen && (
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
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename channel</DialogTitle>
            <DialogDescription>Choose a new name for #{selectedChannel.name}.</DialogDescription>
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
                  renaming || !renameName.trim() || renameName.trim() === selectedChannel.name
                }
              >
                {renaming ? <Spinner /> : "Rename"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete channel?</DialogTitle>
            <DialogDescription>
              This will permanently delete #{selectedChannel.name} and all of its messages. This
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
  active,
}: {
  readonly showId: ShowId;
  readonly profile: Profile;
  readonly profiles: ReadonlyArray<Profile>;
  readonly channel: ChatChannel;
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
                      <Bubble variant={mine ? "default" : "secondary"}>
                        <BubbleContent className="whitespace-pre-wrap">
                          {message.body}
                        </BubbleContent>
                      </Bubble>
                      <MessageFooter>
                        {DateTime.formatIso(message.sentAt).slice(11, 16)}
                      </MessageFooter>
                    </MessageContent>
                  </Message>
                </MessageScroller.Item>
              );
            })}
          </MessageScroller.Content>
        </ScrollArea>
        <ReadTracker showId={showId} profileId={profile.id} channel={channel} active={active} />
        <Composer showId={showId} profileId={profile.id} channelId={channel.id} />
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
}: {
  readonly showId: ShowId;
  readonly profileId: ProfileId;
  readonly channelId: ChatChannelId;
}) {
  const send = useAtomSet(chatAtoms(showId, profileId).send, { mode: "promiseExit" });
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string>();

  React.useLayoutEffect(() => {
    if (textareaRef.current) resizeComposer(textareaRef.current);
  }, [body]);

  const submit = async () => {
    const submittedDraft = body;
    const trimmed = submittedDraft.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(undefined);
    const exit = await send({
      payload: {
        showId,
        channelId,
        senderProfileId: profileId,
        body: trimmed as ChatMessageBody,
      },
      reactivityKeys: chatsSyncKey(showId),
    });
    if (Exit.isFailure(exit)) setError(rpcErrorMessageFromCause(exit.cause));
    else setBody((current) => (current === submittedDraft ? "" : current));
    setSending(false);
  };

  return (
    <div className="shrink-0 border-t p-2 sm:p-3">
      <InputGroup>
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
    </div>
  );
}
