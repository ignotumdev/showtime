import { useAtomValue } from "@effect/atom-react";
import { useNavigate } from "@tanstack/react-router";
import { Option } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import { showsAtom } from "@/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { showColorClassNames } from "@/components/shows/show-color";
import { cn } from "@/lib/utils";

const allShowsValue = "all-shows";

export function ShowSwitcher({
  showId,
  destination,
}: {
  readonly showId?: string;
  readonly destination: "show" | "settings";
}) {
  const navigate = useNavigate();
  const result = useAtomValue(showsAtom);
  const shows = AsyncResult.isSuccess(result)
    ? result.value
    : AsyncResult.isFailure(result)
      ? (Option.getOrUndefined(result.previousSuccess)?.value ?? [])
      : [];
  const selected = shows.find((show) => show.id === showId);

  const select = (value: string | null) => {
    if (!value) return;
    if (value === allShowsValue) {
      void navigate(
        destination === "settings"
          ? { to: "/settings/$section", params: { section: "updates" } }
          : { to: "/" },
      );
      return;
    }

    void navigate(
      destination === "settings"
        ? {
            to: "/shows/$showId/settings/$section",
            params: { showId: value, section: "general" },
          }
        : { to: "/shows/$showId", params: { showId: value } },
    );
  };

  return (
    <div className="no-drag-region">
      <Select value={showId ?? allShowsValue} onValueChange={select}>
        <SelectTrigger aria-label="Active show">
          <SelectValue>
            {selected ? <ShowLabel name={selected.name} color={selected.color} /> : "All shows"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={allShowsValue}>All shows</SelectItem>
          {shows.map((show) => (
            <SelectItem
              key={show.id}
              value={show.id}
              disabled={"pending" in show && show.pending === true}
            >
              <ShowLabel name={show.name} color={show.color} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ShowLabel({
  name,
  color,
}: {
  readonly name: string;
  readonly color: keyof typeof showColorClassNames;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className={cn(showColorClassNames[color], "size-3 shrink-0 rounded-sm")} />
      <span className="truncate">{name}</span>
    </span>
  );
}
