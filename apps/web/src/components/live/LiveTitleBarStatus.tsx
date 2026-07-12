import { Badge } from "@/components/ui/badge";

export function LiveTitleBarStatus({
  position,
  total,
  elapsed,
}: {
  readonly position: number;
  readonly total: number;
  readonly elapsed: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <Badge variant="destructive">{elapsed}</Badge>
      <span className="ml-auto flex">
        <Badge variant="outline">
          <span className="sm:hidden">
            {position}/{total}
          </span>
          <span className="hidden sm:inline">
            {position} of {total} songs
          </span>
        </Badge>
      </span>
    </div>
  );
}
