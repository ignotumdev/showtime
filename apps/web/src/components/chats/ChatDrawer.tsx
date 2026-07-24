import * as React from "react";
import { useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/unstable/reactivity";
import type { ChatChannelId, ChatSnapshot, Profile, ProfileId, ShowId } from "@showtime/contracts";
import { chatAtoms, profileAtoms } from "@/client";
import { registerChatAnswerDialog } from "@/chats/ChatAnswerDialogPresence";
import {
  planChatAnswerRequests,
  type AnswerRequest,
  type ChatAnswerRequestSequences,
} from "@/chats/ChatAnswerRequestPolicy";
import { consumeChatOpenRequest, subscribeChatOpenRequests } from "@/chats/ChatNavigation";
import { ChatWorkspace } from "@/components/chats/ChatWorkspace";
import { ChatPresetAnswerDialog } from "@/components/chats/ChatPresetAnswer";
import { ProfileSwitcher } from "@/components/profiles/ProfileSwitcher";
import { Badge } from "@/components/ui/badge";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useSelectedProfile } from "@/profiles";

interface ChatDrawerProps {
  readonly showId: ShowId;
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly trigger?: (unreadCount: number) => React.ReactElement;
  readonly onSelectedChannelChange?: (channelId: ChatChannelId) => void;
}

export function ChatDrawer(props: ChatDrawerProps) {
  const profilesResult = useAtomValue(profileAtoms.state);
  const profileState = AsyncResult.isSuccess(profilesResult) ? profilesResult.value : undefined;
  const { selected } = useSelectedProfile(profileState);

  return selected ? (
    <ProfileChatDrawer
      key={`${props.showId}:${selected.id}`}
      {...props}
      profile={selected}
      profiles={profileState?.profiles ?? []}
    />
  ) : (
    <ChatDrawerView {...props} unreadCount={0} />
  );
}

function ProfileChatDrawer({
  profile,
  profiles,
  ...props
}: ChatDrawerProps & {
  readonly profile: Profile;
  readonly profiles: ReadonlyArray<Profile>;
}) {
  const result = useAtomValue(chatAtoms(props.showId, profile.id).state);
  const snapshot = AsyncResult.isSuccess(result) ? result.value : undefined;
  const unreadCount = AsyncResult.isSuccess(result)
    ? result.value.channels.reduce((total, channel) => total + channel.unreadCount, 0)
    : 0;
  return (
    <ChatDrawerView
      {...props}
      unreadCount={unreadCount}
      profile={profile}
      profiles={profiles}
      snapshot={snapshot}
    />
  );
}

function ChatDrawerView({
  showId,
  unreadCount,
  open: controlledOpen,
  onOpenChange,
  trigger,
  onSelectedChannelChange,
  profile,
  profiles = [],
  snapshot,
}: ChatDrawerProps & {
  readonly unreadCount: number;
  readonly profile?: Profile;
  readonly profiles?: ReadonlyArray<Profile>;
  readonly snapshot?: ChatSnapshot;
}) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [selectedChannelId, setSelectedChannelId] = React.useState<ChatChannelId>();
  const newestSequences = React.useRef<ChatAnswerRequestSequences | undefined>(undefined);
  const selectChannel = React.useCallback(
    (channelId: ChatChannelId) => {
      setSelectedChannelId(channelId);
      onSelectedChannelChange?.(channelId);
    },
    [onSelectedChannelChange],
  );
  const [isMobile, setIsMobile] = React.useState(() =>
    typeof window === "undefined" ? false : !window.matchMedia("(min-width: 640px)").matches,
  );

  React.useEffect(() => {
    const query = window.matchMedia("(min-width: 640px)");
    const update = () => setIsMobile(!query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const openRequestedChat = React.useEffectEvent(() => {
    const request = consumeChatOpenRequest(showId);
    if (!request) return;
    selectChannel(request.channelId);
    setOpen(true);
  });

  React.useEffect(() => {
    openRequestedChat();
    return subscribeChatOpenRequests(openRequestedChat);
  }, []);

  return (
    <>
      <Drawer open={open} onOpenChange={setOpen} swipeDirection={isMobile ? "down" : "right"}>
        {trigger && <DrawerTrigger render={trigger(unreadCount)} />}
        <DrawerContent
          className={
            isMobile
              ? "[--drawer-height:calc(var(--app-height)-3rem)]"
              : "data-[swipe-axis=x]:[--drawer-content-width:min(44rem,100vw)]"
          }
        >
          <DrawerHeader className="flex-row items-center justify-between pb-3 text-left">
            <DrawerTitle>Chat</DrawerTitle>
            {isMobile && <ProfileSwitcher variant="avatar" />}
          </DrawerHeader>
          <div className="min-h-0 flex-1 px-2 pb-2">
            <ChatWorkspace
              showId={showId}
              active={open}
              compact
              requestedChannelId={selectedChannelId}
              onSelectedChannelChange={selectChannel}
            />
          </div>
        </DrawerContent>
      </Drawer>
      {profile && (
        <ChatAnswerPrompt
          key={open ? "open" : "closed"}
          showId={showId}
          open={open}
          profile={profile}
          profiles={profiles}
          snapshot={snapshot}
          newestSequences={newestSequences}
        />
      )}
    </>
  );
}

function ChatAnswerPrompt({
  showId,
  open,
  profile,
  profiles,
  snapshot,
  newestSequences,
}: {
  readonly showId: ShowId;
  readonly open: boolean;
  readonly profile: Profile;
  readonly profiles: ReadonlyArray<Profile>;
  readonly snapshot: ChatSnapshot | undefined;
  readonly newestSequences: React.RefObject<ChatAnswerRequestSequences | undefined>;
}) {
  const [pendingAnswers, setPendingAnswers] = React.useState<ReadonlyArray<AnswerRequest>>([]);

  React.useLayoutEffect(() => {
    if (open) return;
    return registerChatAnswerDialog(showId, profile.id);
  }, [open, profile.id, showId]);

  React.useEffect(() => {
    if (!snapshot) return;
    const { requests, sequences } = planChatAnswerRequests({
      channels: snapshot.channels,
      profileId: profile.id,
      previousSequences: newestSequences.current,
      shouldPrompt: !open,
    });
    newestSequences.current = sequences;
    if (requests.length > 0)
      setPendingAnswers((current) => [
        ...current,
        ...requests.filter((request) => !current.some((item) => item.id === request.id)),
      ]);
  }, [newestSequences, open, profile.id, snapshot]);

  const pendingAnswer = pendingAnswers[0];
  const pendingChannel = pendingAnswer
    ? snapshot?.channels.find((channel) => channel.id === pendingAnswer.channelId)
    : undefined;
  const pendingAnswered = Boolean(
    pendingAnswer &&
    pendingChannel?.messages.some(
      (message) =>
        message.replyToMessageId === pendingAnswer.id && message.senderProfileId === profile.id,
    ),
  );
  const dismissPendingAnswer = () => setPendingAnswers((current) => current.slice(1));

  return (
    <ChatPresetAnswerDialog
      open={Boolean(pendingAnswer) && !open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) dismissPendingAnswer();
      }}
      showId={showId}
      profileId={profile.id}
      request={pendingAnswer}
      senderName={
        profiles.find((candidate) => candidate.id === pendingAnswer?.senderProfileId)?.name ??
        "the sender"
      }
      answered={pendingAnswered}
      onAnswered={dismissPendingAnswer}
    />
  );
}

export function ChatUnreadBadge({ showId }: { readonly showId: ShowId }) {
  const profilesResult = useAtomValue(profileAtoms.state);
  const profileState = AsyncResult.isSuccess(profilesResult) ? profilesResult.value : undefined;
  const { selected } = useSelectedProfile(profileState);
  return selected ? <ProfileChatUnreadBadge showId={showId} profileId={selected.id} /> : null;
}

function ProfileChatUnreadBadge({
  showId,
  profileId,
}: {
  readonly showId: ShowId;
  readonly profileId: ProfileId;
}) {
  const result = useAtomValue(chatAtoms(showId, profileId).state);
  const unreadCount = AsyncResult.isSuccess(result)
    ? result.value.channels.reduce((total, channel) => total + channel.unreadCount, 0)
    : 0;
  return unreadCount > 0 ? (
    <Badge className="min-w-5 justify-center px-1">{unreadCount > 99 ? "99+" : unreadCount}</Badge>
  ) : null;
}
