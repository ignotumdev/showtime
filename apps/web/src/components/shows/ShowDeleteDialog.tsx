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
import { useAtom, useAtomSet } from "@effect/atom-react";
import { deleteShowAtom, showDialogAtom, showMutationOptions } from "@/client";
import { rpcErrorMessageFromCause } from "@/client";

type ShowDeleteDialogProps = {
  readonly onDeleted?: () => void | Promise<void>;
};

export function ShowDeleteDialog({ onDeleted }: ShowDeleteDialogProps) {
  const [dialog, setDialog] = useAtom(showDialogAtom);
  const deleteShow = useAtomSet(deleteShowAtom, { mode: "promiseExit" });
  const isOpen = dialog.type === "delete";
  const showName = dialog.type === "delete" ? dialog.show.name : "this show";
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | undefined>();
  const dialogRef = React.useRef(dialog);

  React.useEffect(() => {
    dialogRef.current = dialog;
  }, [dialog]);

  const close = () => setDialog({ type: "closed" });

  const notifyDeleted = () => {
    if (!onDeleted) {
      return;
    }

    try {
      void Promise.resolve(onDeleted()).catch((error: unknown) => {
        console.error("Show deletion follow-up failed", error);
      });
    } catch (error) {
      console.error("Show deletion follow-up failed", error);
    }
  };

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

    const deletingShowId = dialog.show.id;
    setIsDeleting(true);
    setDeleteError(undefined);

    try {
      const result = await deleteShow({
        payload: {
          id: deletingShowId,
        },
        ...showMutationOptions,
      });

      const currentDialog = dialogRef.current;
      if (currentDialog.type !== "delete" || currentDialog.show.id !== deletingShowId) {
        return;
      }

      if (Exit.isSuccess(result)) {
        close();
        notifyDeleted();
      } else {
        setDeleteError(rpcErrorMessageFromCause(result.cause));
      }
    } finally {
      setIsDeleting((current) => {
        const currentDialog = dialogRef.current;
        return currentDialog.type === "delete" && currentDialog.show.id === deletingShowId
          ? false
          : current;
      });
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
