import iconUrl from "../../../../assets/icon.svg";
import {
  microphonesRpcReactivityKey,
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

type TitleBarProps = {
  hideName?: boolean;
  isMacOS?: boolean;
  liveShow?: {
    readonly id: ShowId;
    readonly name: ShowName;
    readonly color: Color;
  };
  stack?: "default" | "above-content" | "below-content";
};

export function TitleBar({
  hideName = false,
  isMacOS = navigator.userAgent.includes("Macintosh"),
  liveShow,
  stack = "default",
}: TitleBarProps) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const params = useParams({ strict: false });
  const setDialog = useAtomSet(showDialogAtom);
  const isShowsRoute = pathname === "/";
  const isMicrophonesRoute = pathname.endsWith("/microphones");
  const isLiveRoute = pathname.includes("/live");
  const showId = typeof params.showId === "string" ? params.showId : undefined;
  const showColorClassName = showColorClassNames[liveShow?.color ?? "neutral"];

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
            render={showId ? <Link to="/shows/$showId" params={{ showId }} /> : <Link to="/" />}
          >
            <ArrowLeftIcon /> Back
          </Button>
        )}
      </div>
      {liveShow && (
        <div className="pointer-events-none absolute left-1/2 flex max-w-[min(28rem,calc(100%-12rem))] -translate-x-1/2 items-center gap-2">
          <span className={`${showColorClassName} size-4 shrink-0 rounded`} />
          <span className="truncate text-sm font-semibold text-[#fafafa]">{liveShow.name}</span>
        </div>
      )}
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
      </div>
    </header>
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
