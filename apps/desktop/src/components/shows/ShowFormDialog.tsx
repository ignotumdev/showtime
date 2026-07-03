import * as React from "react";
import { PlusIcon } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { useAtom, useAtomSet } from "@/frontend/react/AtomProvider";
import {
  createShowAtom,
  renameShowAtom,
  showDialogAtom,
  showMutationOptions,
} from "@/frontend/shows/ShowAtoms";

export function ShowFormDialog() {
  const [dialog, setDialog] = useAtom(showDialogAtom);
  const createShow = useAtomSet(createShowAtom);
  const renameShow = useAtomSet(renameShowAtom);
  const isOpen = dialog.type === "create" || dialog.type === "rename";
  const isRename = dialog.type === "rename";
  const [name, setName] = React.useState("");

  React.useEffect(() => {
    setName(dialog.type === "rename" ? dialog.show.name : "");
  }, [dialog]);

  const close = React.useCallback(() => setDialog({ type: "closed" }), [setDialog]);

  const submit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = name.trim();
      if (trimmed.length === 0) {
        return;
      }

      if (dialog.type === "rename") {
        renameShow({
          payload: {
            id: dialog.show.id,
            name: trimmed,
          },
          ...showMutationOptions,
        });
      } else if (dialog.type === "create") {
        createShow({
          payload: {
            name: trimmed,
          },
          ...showMutationOptions,
        });
      }

      close();
    },
    [close, createShow, dialog, name, renameShow],
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <form className="grid gap-4" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{isRename ? "Rename show" : "New show"}</DialogTitle>
            <DialogDescription>
              {isRename ? "Update the show name." : "Create a show."}
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
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={name.trim().length === 0}>
              {!isRename && <PlusIcon />}
              {isRename ? "Rename" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
