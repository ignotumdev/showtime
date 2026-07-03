import iconUrl from "../../../../assets/icon.svg";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type TitleBarProps = {
  isMacOS?: boolean;
};

export function TitleBar({ isMacOS = false }: TitleBarProps) {
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
      <div className="no-drag-region ml-auto flex items-center gap-1" aria-label="Window toolbar" />
    </header>
  );
}
