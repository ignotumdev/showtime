import { TitleBar } from "@/components/TitleBar";
import { LiveTitleBarStatus } from "@/components/live/LiveTitleBarStatus";
import { songAtoms } from "@/client";
import { endLiveSession, useLiveElapsed } from "@/lib/LiveSession";
import { useAtomValue } from "@effect/atom-react";
import { useShowFromParams } from "@/hooks/useShowFromParams";
import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import type { ShowId } from "@showtime/contracts";
import { AsyncResult } from "effect/unstable/reactivity";
import React from "react";

export const Route = createFileRoute("/live")({
  component: RouteComponent,
});

function RouteComponent() {
  const { show: liveShow, showId } = useShowFromParams();
  if (!showId) {
    return (
      <React.Fragment>
        <TitleBar hideName={true} stack="above-content" />
        <div className="h-screen overflow-hidden pt-10">
          <Outlet />
        </div>
      </React.Fragment>
    );
  }

  return <LiveRouteContent key={showId} liveShow={liveShow} showId={showId as ShowId} />;
}

function LiveRouteContent({
  liveShow,
  showId,
}: {
  readonly liveShow: ReturnType<typeof useShowFromParams>["show"];
  readonly showId: ShowId;
}) {
  const typedShowId = showId;
  const songsResult = useAtomValue(songAtoms(typedShowId).songs);
  const songs = AsyncResult.getOrElse(songsResult, () => []).filter((song) => !song.deletedAt);
  const search = useRouterState({ select: (state) => state.location.search });
  const selectedId = typeof search.song === "string" ? search.song : undefined;
  const selectedIndex = Math.max(
    0,
    songs.findIndex((song) => song.id === selectedId),
  );
  const selectedSong = songs[selectedIndex];
  const elapsed = useLiveElapsed(typedShowId);

  return (
    <React.Fragment>
      <TitleBar
        hideName={true}
        liveShow={liveShow}
        liveStatus={
          selectedSong ? (
            <LiveTitleBarStatus
              position={selectedIndex + 1}
              total={songs.length}
              elapsed={elapsed}
            />
          ) : undefined
        }
        onLiveBack={() => endLiveSession(typedShowId)}
        stack="above-content"
      />
      <div className="h-screen overflow-hidden pt-10">
        <Outlet />
      </div>
    </React.Fragment>
  );
}
