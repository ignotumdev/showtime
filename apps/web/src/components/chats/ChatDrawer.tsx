import * as React from "react";
import { useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/unstable/reactivity";
import type { ChatChannelId, ProfileId, ShowId } from "@showtime/contracts";
import { chatAtoms, profileAtoms } from "@/client";
import { consumeChatOpenRequest, subscribeChatOpenRequests } from "@/chats/ChatNavigation";
import { ChatWorkspace } from "@/components/chats/ChatWorkspace";
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
}

export function ChatDrawer(props: ChatDrawerProps) {
  const profilesResult = useAtomValue(profileAtoms.state);
  const profileState = AsyncResult.isSuccess(profilesResult) ? profilesResult.value : undefined;
  const { selected } = useSelectedProfile(profileState);

  return selected ? (
    <ProfileChatDrawer key={selected.id} {...props} profileId={selected.id} />
  ) : (
    <ChatDrawerView {...props} unreadCount={0} />
  );
}

function ProfileChatDrawer({
  profileId,
  ...props
}: ChatDrawerProps & { readonly profileId: ProfileId }) {
  const result = useAtomValue(chatAtoms(props.showId, profileId).state);
  const unreadCount = AsyncResult.isSuccess(result)
    ? result.value.channels.reduce((total, channel) => total + channel.unreadCount, 0)
    : 0;
  return <ChatDrawerView {...props} unreadCount={unreadCount} />;
}

function ChatDrawerView({
  showId,
  unreadCount,
  open: controlledOpen,
  onOpenChange,
  trigger,
}: ChatDrawerProps & { readonly unreadCount: number }) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [selectedChannelId, setSelectedChannelId] = React.useState<ChatChannelId>();
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

  React.useEffect(() => {
    const openRequestedChat = () => {
      const request = consumeChatOpenRequest(showId);
      if (!request) return;
      setSelectedChannelId(request.channelId);
      setOpen(true);
    };
    openRequestedChat();
    return subscribeChatOpenRequests(openRequestedChat);
  }, [setOpen, showId]);

  return (
    <Drawer open={open} onOpenChange={setOpen} swipeDirection={isMobile ? "down" : "right"}>
      {trigger && <DrawerTrigger render={trigger(unreadCount)} />}
      <DrawerContent
        className={
          isMobile
            ? "[--drawer-height:calc(100dvh-3rem)]"
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
            onSelectedChannelChange={setSelectedChannelId}
          />
        </div>
      </DrawerContent>
    </Drawer>
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
