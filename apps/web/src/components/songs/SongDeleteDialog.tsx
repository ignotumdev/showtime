import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { Exit } from "effect";
import { Trash2Icon } from "lucide-react";
import type { ShowId, SongId } from "@showtime/contracts";
import { useAtomSet } from "@effect/atom-react";
import { rpcErrorMessageFromCause, songAtoms, songsRpcReactivityKey } from "@/client";
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

export function SongDeleteDialog({
  showId,
  songId,
  songName,
  open,
  onOpenChange,
}: {
  readonly showId: ShowId;
  readonly songId: SongId;
  readonly songName: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const deleteSong = useAtomSet(songAtoms(showId).delete, { mode: "promiseExit" });
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const confirm = async () => {
    setIsDeleting(true);
    setError(undefined);
    try {
      const result = await deleteSong({
        payload: { showId, id: songId },
        reactivityKeys: songsRpcReactivityKey(showId),
      });
      if (Exit.isFailure(result)) {
        setError(rpcErrorMessageFromCause(result.cause));
        return;
      }
      onOpenChange(false);
      void navigate({ to: "/shows/$showId/setlist", params: { showId } });
    } finally {
      setIsDeleting(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete song?</DialogTitle>
          <DialogDescription>
            “{songName}” will be removed from the active setlist.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" disabled={isDeleting} />}>
            Cancel
          </DialogClose>
          <Button variant="destructive" disabled={isDeleting} onClick={confirm}>
            <Trash2Icon /> {isDeleting ? "Deleting..." : "Delete song"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
