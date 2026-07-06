import { Link } from "@tanstack/react-router";
import { EllipsisIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { useAtomSet } from "@/frontend/react/AtomProvider";
import { showDialogAtom, type ShowListItem } from "@/frontend/shows/ShowAtoms";
import { formatRelativeDate } from "@/lib/dates";
import { showColorClassNames } from "./show-color";

type ShowItemProps = {
  readonly show: ShowListItem;
  readonly now: Date;
};

export function ShowItem({ show, now }: ShowItemProps) {
  const setDialog = useAtomSet(showDialogAtom);

  return (
    <Item variant="outline" className="relative">
      <Link
        to="/shows/$showId"
        params={{ showId: show.id }}
        aria-label={`Open ${show.name}`}
        className="absolute inset-0 rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      />
      <ItemMedia className="pointer-events-none">
        <div className={`${showColorClassNames[show.color]} size-6 rounded-md`} />
      </ItemMedia>
      <ItemContent className="pointer-events-none">
        <ItemTitle>{show.name}</ItemTitle>
        <ItemDescription title={show.updatedAt}>
          {formatRelativeDate(show.updatedAt, now)}
        </ItemDescription>
      </ItemContent>
      <ItemActions className="relative z-10">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon-sm" disabled={show.pending} />}
          >
            <EllipsisIcon />
            <span className="sr-only">Show actions</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={6}>
            <DropdownMenuItem onClick={() => setDialog({ type: "edit", show })}>
              <PencilIcon />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setDialog({ type: "delete", show })}
            >
              <Trash2Icon />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </ItemActions>
    </Item>
  );
}
