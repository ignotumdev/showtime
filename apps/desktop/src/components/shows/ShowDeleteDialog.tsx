import * as React from "react";
import { Trash2Icon } from "lucide-react";
import { Exit } from "effect";
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
import { showRpcErrorMessageFromCause } from "@/frontend/rpc/errors";

type ShowDeleteDialogProps = {
  readonly onDeleted?: () => void;
};

export function ShowDeleteDialog({ onDeleted }: ShowDeleteDialogProps) {
  const [dialog, setDialog] = useAtom(showDialogAtom);
  const deleteShow = useAtomSet(deleteShowAtom, { mode: "promiseExit" });
  const isOpen = dialog.type === "delete";
  const showName = dialog.type === "delete" ? dialog.show.name : "this show";
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | undefined>();

  const close = () => setDialog({ type: "closed" });

  React.useEffect(() => {
    if (dialog.type === "delete") {
      setIsDeleting(false);
      setDeleteError(undefined);
    }
  }, [dialog]);

  const confirmDelete = async () => {
    if (dialog.type !== "delete") {
      return;
    }

    setIsDeleting(true);
    setDeleteError(undefined);

    const result = await deleteShow({
      payload: {
        id: dialog.show.id,
      },
      ...showMutationOptions,
    });

    if (Exit.isSuccess(result)) {
      close();
      onDeleted?.();
    } else {
      setDeleteError(showRpcErrorMessageFromCause(result.cause));
      setIsDeleting(false);
    }
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
        {deleteError && (
          <p role="alert" className="text-sm text-destructive">
            {deleteError}
          </p>
        )}
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" disabled={isDeleting} />}>
            Cancel
          </DialogClose>
          <Button type="button" variant="destructive" disabled={isDeleting} onClick={confirmDelete}>
            <Trash2Icon />
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
