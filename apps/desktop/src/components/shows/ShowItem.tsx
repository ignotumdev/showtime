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
    <Item variant="outline">
      <ItemMedia>
        <div className={`${showColorClassNames[show.color]} size-6 rounded-md`} />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{show.name}</ItemTitle>
        <ItemDescription title={show.updatedAt}>
          {formatRelativeDate(show.updatedAt, now)}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
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
