import * as React from "react";
import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react";
import { showColors, type ShowColor, type ShowName } from "@showtime/contracts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAtom, useAtomSet } from "@/frontend/react/AtomProvider";
import {
  createShowAtom,
  editShowAtom,
  showDialogAtom,
  showMutationOptions,
} from "@/frontend/shows/ShowAtoms";
import { cn } from "@/lib/utils";
import { showColorClassNames } from "./show-color";
import { Input } from "../ui/input";

const randomShowColor = (): ShowColor =>
  showColors[Math.floor(Math.random() * showColors.length)] ?? "sky";

export function ShowFormDialog() {
  const [dialog, setDialog] = useAtom(showDialogAtom);
  const createShow = useAtomSet(createShowAtom);
  const editShow = useAtomSet(editShowAtom);
  const isOpen = dialog.type === "create" || dialog.type === "edit";
  const isEdit = dialog.type === "edit";
  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState<ShowColor>("sky");

  React.useEffect(() => {
    if (dialog.type === "edit") {
      setName(dialog.show.name);
      setColor(dialog.show.color);
      return;
    }

    if (dialog.type === "create") {
      setName("");
      setColor(randomShowColor());
    }
  }, [dialog]);

  const close = React.useCallback(() => setDialog({ type: "closed" }), [setDialog]);

  const submit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = name.trim();
      if (trimmed.length === 0) {
        return;
      }

      if (dialog.type === "edit") {
        editShow({
          payload: {
            id: dialog.show.id,
            name: trimmed as ShowName,
            color,
          },
          ...showMutationOptions,
        });
      } else if (dialog.type === "create") {
        createShow({
          payload: {
            name: trimmed as ShowName,
            color,
          },
          ...showMutationOptions,
        });
      }

      close();
    },
    [close, color, createShow, dialog, editShow, name],
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <form className="grid gap-4" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit show" : "New show"}</DialogTitle>
            <DialogDescription>
              {isEdit ? "Update the show details." : "Create a show."}
            </DialogDescription>
          </DialogHeader>
          <label className="grid gap-2">
            <span className="text-sm font-medium">Show name</span>
            <Input
              autoFocus
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
            />
          </label>
          <div className="grid gap-2">
            <span className="text-sm font-medium">Color</span>
            <Popover>
              <PopoverTrigger render={<Button type="button" variant="outline" />}>
                <div className={cn(showColorClassNames[color], "size-4 rounded")} />
                <span className="capitalize">{color}</span>
                <ChevronsUpDownIcon className="ml-auto" />
              </PopoverTrigger>
              <PopoverContent align="start">
                <div className="grid grid-cols-6 gap-2">
                  {showColors.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className="relative flex size-8 items-center justify-center rounded-md outline-none ring-ring/50 hover:bg-accent focus-visible:ring-3"
                      aria-label={option}
                      aria-pressed={option === color}
                      onClick={() => setColor(option)}
                    >
                      <span className={cn(showColorClassNames[option], "size-5 rounded-md")} />
                      {option === color && (
                        <CheckIcon className="absolute size-3 text-white drop-shadow" />
                      )}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={name.trim().length === 0}>
              {!isEdit && <PlusIcon />}
              {isEdit ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
