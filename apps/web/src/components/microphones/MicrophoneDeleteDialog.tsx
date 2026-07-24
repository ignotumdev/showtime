import * as React from "react";
import { useAtomSet } from "@effect/atom-react";
import { Exit } from "effect";
import { Trash2Icon } from "lucide-react";
import type { ShowId } from "@showtime/contracts";
import {
  microphoneAtoms,
  microphonesRpcReactivityKey,
  rpcErrorMessageFromCause,
  type MicrophoneListItem,
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

export function MicrophoneDeleteDialog({
  microphone,
  showId,
  onClose,
}: {
  readonly microphone: MicrophoneListItem | undefined;
  readonly showId: ShowId;
  readonly onClose: () => void;
}) {
  const deleteMicrophone = useAtomSet(microphoneAtoms(showId).delete, { mode: "promiseExit" });
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string>();

  const confirmDelete = async () => {
    if (!microphone) return;
    setIsDeleting(true);
    setDeleteError(undefined);
    try {
      const result = await deleteMicrophone({
        payload: { showId, id: microphone.id },
        reactivityKeys: microphonesRpcReactivityKey(showId),
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

  const label = microphone?.name?.trim()
    ? `“${microphone.name}” (number ${microphone.number})`
    : `microphone ${microphone?.number ?? ""}`;

  return (
    <Dialog open={microphone !== undefined} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove microphone?</DialogTitle>
          <DialogDescription>
            This will remove {label} from the active microphone list.
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
          <Button variant="destructive" disabled={isDeleting} onClick={confirmDelete}>
            <Trash2Icon /> {isDeleting ? "Removing..." : "Remove"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
