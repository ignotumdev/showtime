import iconUrl from "../../../../assets/icon.svg";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAtomSet } from "@/frontend/react/AtomProvider";
import { showDialogAtom } from "@/frontend/shows/ShowAtoms";
import { useRouterState } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";

type TitleBarProps = {
  isMacOS?: boolean;
};

export function TitleBar({ isMacOS = navigator.userAgent.includes("Macintosh") }: TitleBarProps) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const setDialog = useAtomSet(showDialogAtom);
  const isShowsRoute = pathname === "/";

  return (
    <header
      className={cn(
        "drag-region fixed inset-x-0 top-0 z-10 flex h-10 select-none items-center bg-[#0a0a0a] py-0 pr-35 pl-3",
        isMacOS && "pr-3 pl-20.5",
      )}
    >
      <div className="flex min-w-0 items-center gap-2.25">
        <img className="size-4.5 shrink-0" src={iconUrl} alt="" />
        <span className="truncate text-[13px] leading-none font-bold text-[#fafafa]">Showtime</span>
        <Badge className="dark" variant="outline">
          Alpha
        </Badge>
      </div>
      <div className="no-drag-region ml-auto flex items-center gap-1" aria-label="Window toolbar">
        {isShowsRoute && (
          <Button size="sm" onClick={() => setDialog({ type: "create" })}>
            <PlusIcon />
            New show
          </Button>
        )}
      </div>
    </header>
  );
}
