import { Link, Outlet, useParams, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  ListMusicIcon,
  Mic2Icon,
  PlayIcon,
  PlusIcon,
  SpeakerIcon,
  MessageCircleIcon,
  LibraryIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import React from "react";
import { TitleBar } from "../TitleBar";
import { showColorClassNames } from "./show-color";
import { Badge } from "../ui/badge";
import { useShowFromParams } from "@/hooks/useShowFromParams";
import { AsyncResult } from "effect/unstable/reactivity";
import { Option } from "effect";
import type { ChatChannelId, ShowId, SongId } from "@showtime/contracts";
import { useAtomValue } from "@effect/atom-react";
import { songAtoms } from "@/client";
import { useCreateSong } from "@/components/songs/useCreateSong";
import { ShowPageAction } from "./ShowPageAction";
import { ProfileSwitcher } from "@/components/profiles/ProfileSwitcher";
import { ChatDrawer, ChatUnreadBadge } from "@/components/chats/ChatDrawer";
import { ChatPresetLauncher } from "@/components/chats/ChatPresetLauncher";
import { ConnectionDialog } from "@/components/connections/ConnectionDialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export function ShowLayout() {
  const [chatOpen, setChatOpen] = React.useState(false);
  const [selectedChannelId, setSelectedChannelId] = React.useState<ChatChannelId>();
  const { showId = "", show } = useShowFromParams();
  const showName = show?.name ?? "Show";
  const showColorClassName = showColorClassNames[show?.color ?? "neutral"];
  const typedShowId = showId as ShowId;
  const params = useParams({ strict: false });
  const currentSongId = typeof params.songId === "string" ? (params.songId as SongId) : undefined;
  const songsResult = useAtomValue(songAtoms(typedShowId).songs);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isAllSongsRoute = /\/setlist\/?$/.test(pathname);
  const songs = AsyncResult.isSuccess(songsResult)
    ? songsResult.value
    : AsyncResult.isFailure(songsResult)
      ? (Option.getOrUndefined(songsResult.previousSuccess)?.value ?? [])
      : [];
  const songCreator = useCreateSong(typedShowId, currentSongId);
  return (
    <React.Fragment>
      <TitleBar
        hideName
        stack="above-content"
        className="hidden md:flex"
        actions={
          <>
            <ChatPresetLauncher
              showId={typedShowId}
              channelId={selectedChannelId}
              trigger={({ disabled, onClick }) => (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Open message presets"
                  disabled={disabled}
                  onClick={onClick}
                >
                  <LibraryIcon />
                </Button>
              )}
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="relative"
              aria-label="Open chat"
              onClick={() => setChatOpen(true)}
            >
              <MessageCircleIcon />
              <span className="absolute -top-1 -right-1">
                <ChatUnreadBadge showId={typedShowId} />
              </span>
            </Button>
          </>
        }
      />
      <SidebarProvider className="app-height relative overflow-hidden bg-background">
        <Sidebar collapsible="none" className="relative z-40 hidden md:flex">
          <SidebarHeader>
            <Link
              to="/shows/$showId"
              params={{ showId }}
              className="no-drag-region flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeOptions={{ exact: true }}
            >
              <span className={`${showColorClassName} size-6 shrink-0 rounded-md`} />
              <span className="block truncate">{showName}</span>
            </Link>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarMenu>
                <ShowSidebarLink
                  to="/shows/$showId/microphones"
                  params={{ showId }}
                  label="Microphones"
                  icon={Mic2Icon}
                />
                <ShowSidebarLink
                  to="/shows/$showId/mixes"
                  params={{ showId }}
                  label="Mixes"
                  icon={SpeakerIcon}
                />
              </SidebarMenu>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Setlist</SidebarGroupLabel>
              {!isAllSongsRoute && (
                <SidebarGroupAction
                  type="button"
                  aria-label="Add song"
                  disabled={songCreator.isCreating}
                  onClick={songCreator.createSong}
                >
                  <PlusIcon />
                </SidebarGroupAction>
              )}
              {!isAllSongsRoute && songCreator.error && (
                <p role="alert" className="px-2 text-xs text-destructive">
                  {songCreator.error}
                </p>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  <ShowSidebarLink
                    to="/shows/$showId/setlist"
                    params={{ showId }}
                    label="All songs"
                    icon={ListMusicIcon}
                  />
                  {songs.map((song, id) => (
                    <ShowSidebarLink
                      key={song.id}
                      to="/shows/$showId/setlist/$songId"
                      params={{ showId, songId: song.id }}
                      label={song.name || "New song"}
                      badge={song.artist}
                      number={id + 1}
                    />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <Button
              variant="destructive"
              size="lg"
              render={<Link to="/live/$showId" params={{ showId }} />}
            >
              LIVE
            </Button>
            <ProfileSwitcher className="w-full [&>*:first-child]:flex-1" />
            <Button variant="ghost" render={<Link to="/" />}>
              <ArrowLeftIcon /> Back to all shows
            </Button>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="z-20 min-w-0 overflow-hidden md:pt-10">
          <ShowHeader
            showId={typedShowId}
            showName={showName}
            showColorClassName={showColorClassName}
            pathname={pathname}
            songCreator={songCreator}
          />
          <ScrollArea className="min-h-0 flex-1">
            <div className="h-full px-3 py-3 sm:px-4 sm:py-4">
              <Outlet />
            </div>
          </ScrollArea>
          <MobileBottomNavigation showId={showId} onChatOpen={() => setChatOpen(true)} />
        </SidebarInset>
      </SidebarProvider>
      <ChatDrawer
        showId={typedShowId}
        open={chatOpen}
        onOpenChange={setChatOpen}
        onSelectedChannelChange={setSelectedChannelId}
      />
    </React.Fragment>
  );
}

function ShowHeader({
  showId,
  showName,
  showColorClassName,
  pathname,
  songCreator,
}: {
  readonly showId: ShowId;
  readonly showName: string;
  readonly showColorClassName: string;
  readonly pathname: string;
  readonly songCreator: ReturnType<typeof useCreateSong>;
}) {
  const isAllSongsRoute = /\/setlist\/?$/.test(pathname);

  return (
    <React.Fragment>
      <header className="flex h-[calc(3.5rem+env(safe-area-inset-top))] shrink-0 items-center gap-2 border-b bg-background px-3 pt-[env(safe-area-inset-top)] md:hidden">
        <Link
          to="/shows/$showId"
          params={{ showId }}
          className="flex min-w-0 items-center gap-2 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          activeOptions={{ exact: true }}
        >
          <span className={`${showColorClassName} size-6 shrink-0 rounded-md`} />
          <span className="truncate font-semibold">{showName}</span>
        </Link>
        <div className="ml-auto shrink-0">
          <div className="flex items-center gap-1">
            <ConnectionDialog compact />
            <ShowPageAction showId={showId} pathname={pathname} />
          </div>
        </div>
      </header>
      {isAllSongsRoute && songCreator.error && (
        <p role="alert" className="shrink-0 border-b px-3 py-2 text-xs text-destructive md:hidden">
          {songCreator.error}
        </p>
      )}
    </React.Fragment>
  );
}

function MobileBottomNavigation({
  showId,
  onChatOpen,
}: {
  readonly showId: string;
  readonly onChatOpen: () => void;
}) {
  return (
    <nav
      aria-label="Show navigation"
      className="grid shrink-0 grid-cols-5 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <MobileNavigationLink
        to="/shows/$showId/microphones"
        showId={showId}
        label="Mics"
        icon={Mic2Icon}
      />
      <MobileNavigationLink
        to="/shows/$showId/mixes"
        showId={showId}
        label="Mixes"
        icon={SpeakerIcon}
      />
      <Link
        to="/live/$showId"
        params={{ showId }}
        className="flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium text-destructive outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50"
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-destructive text-white">
          <PlayIcon className="size-4 fill-current" />
        </span>
        Live
      </Link>
      <MobileNavigationLink
        to="/shows/$showId/setlist"
        showId={showId}
        label="Songs"
        icon={ListMusicIcon}
      />
      <button
        type="button"
        className="relative flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50"
        onClick={onChatOpen}
      >
        <MessageCircleIcon className="size-5" />
        Chat
        <span className="absolute top-2 right-[calc(50%-1.5rem)]">
          <ChatUnreadBadge showId={showId as ShowId} />
        </span>
      </button>
    </nav>
  );
}

function MobileNavigationLink({
  to,
  showId,
  label,
  icon: Icon,
}: {
  readonly to: "/shows/$showId/microphones" | "/shows/$showId/mixes" | "/shows/$showId/setlist";
  readonly showId: string;
  readonly label: string;
  readonly icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link
      to={to}
      params={{ showId }}
      activeOptions={to === "/shows/$showId/setlist" ? { includeSearch: false } : undefined}
      activeProps={{ "data-active": true }}
      className="flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 data-active:text-foreground"
    >
      <Icon className="size-5" />
      {label}
    </Link>
  );
}

type ShowSidebarLinkProps = (
  | {
      readonly to:
        | "/shows/$showId"
        | "/shows/$showId/microphones"
        | "/shows/$showId/mixes"
        | "/shows/$showId/setlist";
      readonly params: { readonly showId: string };
    }
  | {
      readonly to: "/shows/$showId/setlist/$songId";
      readonly params: { readonly showId: string; readonly songId: string };
    }
) & {
  readonly label: string;
  readonly badge?: string;
  readonly number?: number;
  readonly icon?: React.ComponentType<{ className?: string }>;
};

function ShowSidebarLink({ to, params, label, badge, number, icon: Icon }: ShowSidebarLinkProps) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={
          <Link
            to={to}
            params={params}
            activeOptions={{ exact: true }}
            activeProps={{ "data-active": true }}
          />
        }
      >
        {number && (
          <div className="flex size-4 items-center justify-center rounded bg-neutral-700 text-xs font-bold leading-none text-neutral-300">
            {number}
          </div>
        )}
        {Icon ? <Icon /> : null}
        <span className="min-w-0 flex-1 truncate" title={label}>
          {label}
        </span>
        {badge && <Badge variant="outline">{badge}</Badge>}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
