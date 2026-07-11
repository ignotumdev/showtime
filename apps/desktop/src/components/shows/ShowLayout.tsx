import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ArrowLeftIcon, ListMusicIcon, Mic2Icon, PlusIcon, SpeakerIcon } from "lucide-react";
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
import { useShowFromParams } from "@/frontend/shows/useShowFromParams";
import { AsyncResult } from "effect/unstable/reactivity";
import { Option } from "effect";
import type { ShowId } from "@showtime/contracts";
import { useAtomValue } from "@effect/atom-react";
import { songAtoms } from "@/frontend";
import { useCreateSong } from "@/components/songs/useCreateSong";

export function ShowLayout() {
  const { showId = "", show } = useShowFromParams();
  const showName = show?.name ?? "Show";
  const showColorClassName = showColorClassNames[show?.color ?? "neutral"];
  const typedShowId = showId as ShowId;
  const songsResult = useAtomValue(songAtoms(typedShowId).songs);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isAllSongsRoute = /\/setlist\/?$/.test(pathname);
  const songs = AsyncResult.isSuccess(songsResult)
    ? songsResult.value
    : AsyncResult.isFailure(songsResult)
      ? (Option.getOrUndefined(songsResult.previousSuccess)?.value ?? [])
      : [];
  const songCreator = useCreateSong(typedShowId);

  return (
    <React.Fragment>
      <TitleBar hideName={true} stack="above-content" />
      <SidebarProvider className="relative h-screen overflow-hidden bg-background">
        <Sidebar collapsible="none" className="relative z-40">
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
            <Button variant="ghost" render={<Link to="/" />}>
              <ArrowLeftIcon /> Back to all shows
            </Button>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="z-20 min-w-0 overflow-auto px-4 pt-14 pb-4">
          <Outlet />
        </SidebarInset>
      </SidebarProvider>
    </React.Fragment>
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
        <span>{label}</span>
        {badge && <Badge variant="outline">{badge}</Badge>}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
