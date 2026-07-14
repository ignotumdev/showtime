import iconUrl from "../../../../assets/icon.svg";
import { type Color, type ShowId, type ShowName } from "@showtime/contracts";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAtomSet } from "@effect/atom-react";
import { showDialogAtom } from "@/client";
import { Link, useParams, useRouterState } from "@tanstack/react-router";
import { ArrowLeftIcon, PlusIcon } from "lucide-react";
import { showColorClassNames } from "./shows/show-color";
import { isDesktopHost } from "@/platform";
import { ConnectionDialog } from "@/components/connections/ConnectionDialog";
import { ShowPageAction } from "@/components/shows/ShowPageAction";

type TitleBarProps = {
  className?: string;
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
  className,
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
  const isLiveRoute = pathname.includes("/live");
  const showId = typeof params.showId === "string" ? params.showId : undefined;
  const showColorClassName = showColorClassNames[liveShow?.color ?? "neutral"];
  const desktopHost = isDesktopHost();

  return (
    <header
      style={
        desktopHost
          ? isMacOS
            ? { paddingLeft: "5.125rem", paddingRight: "0.75rem" }
            : { paddingRight: "8.75rem" }
          : undefined
      }
      className={cn(
        "fixed inset-x-0 top-0 z-10 flex h-10 min-w-0 select-none items-center bg-[#0a0a0a] px-2 py-0 sm:px-3",
        desktopHost && "drag-region",
        stack === "below-content" && "z-0",
        stack === "above-content" && "z-30",
        className,
      )}
    >
      <div className="no-drag-region flex items-center gap-1" aria-label="Window toolbar">
        {isLiveRoute && (
          <Button
            variant="ghost"
            onClick={onLiveBack}
            render={showId ? <Link to="/shows/$showId" params={{ showId }} /> : <Link to="/" />}
          >
            <ArrowLeftIcon /> <span className="hidden sm:inline">Back</span>
          </Button>
        )}
        {isLiveRoute && liveShow && (
          <span className="hidden min-w-0 max-w-72 items-center gap-2 sm:flex">
            <span className={`${showColorClassName} size-4 shrink-0 rounded`} />
            <span className="truncate text-sm font-semibold text-[#fafafa]">{liveShow.name}</span>
          </span>
        )}
      </div>
      {isLiveRoute && liveStatus ? (
        <div className="pointer-events-none ml-1 flex min-w-0 flex-1 items-center sm:ml-2">
          {liveStatus}
        </div>
      ) : liveShow && !isLiveRoute ? (
        <div className="pointer-events-none absolute left-1/2 flex max-w-[min(28rem,calc(100%-12rem))] -translate-x-1/2 items-center gap-2">
          <span className={`${showColorClassName} size-4 shrink-0 rounded`} />
          <span className="truncate text-sm font-semibold text-[#fafafa]">{liveShow.name}</span>
        </div>
      ) : null}
      {!hideName && (
        <div className="flex min-w-0 items-center gap-2 sm:gap-2.25">
          <img className="size-6 shrink-0" src={iconUrl} alt="" />
          <span className="truncate text-base leading-none font-bold text-[#fafafa] sm:text-lg">
            Showtime
          </span>
          <Badge className="dark hidden sm:inline-flex" variant="outline">
            Alpha
          </Badge>
        </div>
      )}
      <div className="no-drag-region ml-auto flex items-center gap-1" aria-label="Window toolbar">
        {!isLiveRoute && (
          <>
            <ConnectionDialog compact className="md:hidden" />
            <ConnectionDialog className="hidden md:inline-flex" />
          </>
        )}
        {isShowsRoute && (
          <Button size="sm" aria-label="New show" onClick={() => setDialog({ type: "create" })}>
            <PlusIcon />
            <span className="hidden min-[400px]:inline">New show</span>
          </Button>
        )}
        {!isShowsRoute && !isLiveRoute && showId && (
          <ShowPageAction showId={showId as ShowId} pathname={pathname} />
        )}
      </div>
    </header>
  );
}
