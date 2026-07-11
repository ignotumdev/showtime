import iconUrl from "../../../../assets/icon.svg";
import {
  microphonesRpcReactivityKey,
  mixesRpcReactivityKey,
  type Color,
  type ShowId,
  type ShowName,
} from "@showtime/contracts";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAtomSet } from "@/frontend/react/AtomProvider";
import { showDialogAtom } from "@/frontend/shows/ShowAtoms";
import { Link, useParams, useRouterState } from "@tanstack/react-router";
import { ArrowLeftIcon, PlusIcon } from "lucide-react";
import { randomShowColor, showColorClassNames } from "./shows/show-color";
import { microphoneAtoms } from "@/frontend/microphones/MicrophoneAtoms";
import { mixAtoms } from "@/frontend/mixes/MixAtoms";
import { useCreateSong } from "@/components/songs/useCreateSong";

type TitleBarProps = {
  hideName?: boolean;
  isMacOS?: boolean;
  liveStatus?: React.ReactNode;
  liveShow?: {
    readonly id: ShowId;
    readonly name: ShowName;
    readonly color: Color;
  };
  onLiveBack?: () => void;
  stack?: "default" | "above-content" | "below-content";
};

export function TitleBar({
  hideName = false,
  isMacOS = navigator.userAgent.includes("Macintosh"),
  liveStatus,
  liveShow,
  onLiveBack,
  stack = "default",
}: TitleBarProps) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const params = useParams({ strict: false });
  const setDialog = useAtomSet(showDialogAtom);
  const isShowsRoute = pathname === "/";
  const isMicrophonesRoute = pathname.endsWith("/microphones");
  const isMixesRoute = pathname.endsWith("/mixes");
  const isAllSongsRoute = /\/setlist\/?$/.test(pathname);
  const isLiveRoute = pathname.includes("/live");
  const showId = typeof params.showId === "string" ? params.showId : undefined;
  const showColorClassName = showColorClassNames[liveShow?.color ?? "neutral"];
  const songCreator = useCreateSong((showId ?? "") as ShowId);

  return (
    <header
      className={cn(
        "drag-region fixed inset-x-0 top-0 z-10 flex h-10 select-none items-center bg-[#0a0a0a] py-0 pr-35 pl-3",
        isMacOS && "pr-3 pl-20.5",
        stack === "below-content" && "z-0",
        stack === "above-content" && "z-30",
      )}
    >
      <div className="no-drag-region flex items-center gap-1" aria-label="Window toolbar">
        {isLiveRoute && (
          <Button
            variant="ghost"
            onClick={onLiveBack}
            render={showId ? <Link to="/shows/$showId" params={{ showId }} /> : <Link to="/" />}
          >
            <ArrowLeftIcon /> Back
          </Button>
        )}
        {isLiveRoute && liveShow && (
          <span className="flex min-w-0 max-w-72 items-center gap-2">
            <span className={`${showColorClassName} size-4 shrink-0 rounded`} />
            <span className="truncate text-sm font-semibold text-[#fafafa]">{liveShow.name}</span>
          </span>
        )}
      </div>
      {isLiveRoute && liveStatus ? (
        <div className="pointer-events-none ml-2 flex min-w-0 flex-1 items-center">
          {liveStatus}
        </div>
      ) : liveShow && !isLiveRoute ? (
        <div className="pointer-events-none absolute left-1/2 flex max-w-[min(28rem,calc(100%-12rem))] -translate-x-1/2 items-center gap-2">
          <span className={`${showColorClassName} size-4 shrink-0 rounded`} />
          <span className="truncate text-sm font-semibold text-[#fafafa]">{liveShow.name}</span>
        </div>
      ) : null}
      {!hideName && (
        <div className="flex min-w-0 items-center gap-2.25">
          <img className="size-6 shrink-0" src={iconUrl} alt="" />
          <span className="truncate text-lg leading-none font-bold text-[#fafafa]">Showtime</span>
          <Badge className="dark" variant="outline">
            Alpha
          </Badge>
        </div>
      )}
      <div className="no-drag-region ml-auto flex items-center gap-1" aria-label="Window toolbar">
        {isShowsRoute && (
          <Button size="sm" onClick={() => setDialog({ type: "create" })}>
            <PlusIcon />
            New show
          </Button>
        )}
        {isMicrophonesRoute && showId && <AddMicrophoneButton showId={showId as ShowId} />}
        {isMixesRoute && showId && <AddMixButton showId={showId as ShowId} />}
        {isAllSongsRoute && showId && (
          <Button size="sm" disabled={songCreator.isCreating} onClick={songCreator.createSong}>
            <PlusIcon /> {songCreator.isCreating ? "Adding..." : "Add song"}
          </Button>
        )}
      </div>
      {isAllSongsRoute && songCreator.error && (
        <span role="alert" className="ml-2 text-xs text-destructive">
          {songCreator.error}
        </span>
      )}
    </header>
  );
}

function AddMixButton({ showId }: { readonly showId: ShowId }) {
  const createMix = useAtomSet(mixAtoms(showId).create);
  return (
    <Button
      size="sm"
      onClick={() =>
        createMix({
          payload: { showId, color: randomShowColor() },
          reactivityKeys: mixesRpcReactivityKey(showId),
        })
      }
    >
      <PlusIcon /> Add mix
    </Button>
  );
}

function AddMicrophoneButton({ showId }: { readonly showId: ShowId }) {
  const createMicrophone = useAtomSet(microphoneAtoms(showId).create);
  return (
    <Button
      size="sm"
      onClick={() =>
        createMicrophone({
          payload: { showId, color: randomShowColor() },
          reactivityKeys: microphonesRpcReactivityKey(showId),
        })
      }
    >
      <PlusIcon /> Add microphone
    </Button>
  );
}
