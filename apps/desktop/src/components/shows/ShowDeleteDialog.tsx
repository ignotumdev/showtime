import { Trash2Icon } from "lucide-react";
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
import { useAtom, useAtomSet } from "@/frontend/react/AtomProvider";
import { deleteShowAtom, showDialogAtom, showMutationOptions } from "@/frontend/shows/ShowAtoms";

export function ShowDeleteDialog() {
  const [dialog, setDialog] = useAtom(showDialogAtom);
  const deleteShow = useAtomSet(deleteShowAtom);
  const isOpen = dialog.type === "delete";
  const showName = dialog.type === "delete" ? dialog.show.name : "this show";

  const close = () => setDialog({ type: "closed" });

  const confirmDelete = () => {
    if (dialog.type !== "delete") {
      return;
    }

    deleteShow({
      payload: {
        id: dialog.show.id,
      },
      ...showMutationOptions,
    });
    close();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete show?</DialogTitle>
          <DialogDescription>
            This will permanently delete "{showName}". This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
          <Button type="button" variant="destructive" onClick={confirmDelete}>
            <Trash2Icon />
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
