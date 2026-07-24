import * as React from "react";
import { useAtomSet } from "@effect/atom-react";
import { Exit } from "effect";
import { Trash2Icon } from "lucide-react";
import type { ShowId } from "@showtime/contracts";
import {
  mixAtoms,
  mixesRpcReactivityKey,
  rpcErrorMessageFromCause,
  type MixListItem,
} from "@/client";
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

export function MixDeleteDialog({
  mix,
  showId,
  onClose,
}: {
  readonly mix: MixListItem | undefined;
  readonly showId: ShowId;
  readonly onClose: () => void;
}) {
  const deleteMix = useAtomSet(mixAtoms(showId).delete, { mode: "promiseExit" });
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string>();

  const confirmDelete = async () => {
    if (!mix) return;
    setIsDeleting(true);
    setDeleteError(undefined);
    try {
      const result = await deleteMix({
        payload: { showId, id: mix.id },
        reactivityKeys: mixesRpcReactivityKey(showId),
      });
      if (Exit.isSuccess(result)) {
        onClose();
      } else {
        setDeleteError(rpcErrorMessageFromCause(result.cause));
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const label = mix?.name?.trim() ? `“${mix.name}” (${mix.number})` : `mix ${mix?.number ?? ""}`;

  return (
    <Dialog open={mix !== undefined} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove mix?</DialogTitle>
          <DialogDescription>This will remove {label} from the active mix list.</DialogDescription>
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
          <Button variant="destructive" disabled={isDeleting} onClick={confirmDelete}>
            <Trash2Icon /> {isDeleting ? "Removing..." : "Remove"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
