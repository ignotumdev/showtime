import * as React from "react";
import { AlertCircleIcon, CheckIcon, XIcon } from "lucide-react";
import { Atom, AsyncResult } from "effect/unstable/reactivity";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAtomSet, useAtomValue } from "@/frontend/react/AtomProvider";
import { showMutationAtoms } from "@/frontend/shows/ShowAtoms";
import { showRpcErrorMessageFromCause } from "@/frontend/rpc/errors";

export function ShowMutationStatus() {
  const createResult = useAtomValue(showMutationAtoms[0]);
  const editResult = useAtomValue(showMutationAtoms[1]);
  const deleteResult = useAtomValue(showMutationAtoms[2]);
  const resetCreate = useAtomSet(showMutationAtoms[0]);
  const resetEdit = useAtomSet(showMutationAtoms[1]);
  const resetDelete = useAtomSet(showMutationAtoms[2]);

  const failure = AsyncResult.isFailure(createResult)
    ? createResult
    : AsyncResult.isFailure(editResult)
      ? editResult
      : AsyncResult.isFailure(deleteResult)
        ? deleteResult
        : undefined;
  const waiting =
    (AsyncResult.isSuccess(createResult) && createResult.waiting) ||
    (AsyncResult.isSuccess(editResult) && editResult.waiting) ||
    (AsyncResult.isSuccess(deleteResult) && deleteResult.waiting);
  const success =
    !failure &&
    !waiting &&
    (AsyncResult.isSuccess(createResult) ||
      AsyncResult.isSuccess(editResult) ||
      AsyncResult.isSuccess(deleteResult));

  const reset = React.useCallback(() => {
    resetCreate(Atom.Reset);
    resetEdit(Atom.Reset);
    resetDelete(Atom.Reset);
  }, [resetCreate, resetDelete, resetEdit]);

  React.useEffect(() => {
    if (!success) {
      return;
    }

    const timeout = window.setTimeout(reset, 2_000);
    return () => window.clearTimeout(timeout);
  }, [reset, success]);

  if (!failure && !waiting && !success) {
    return null;
  }

  return (
    <div
      role={failure ? "alert" : "status"}
      aria-live={failure ? "assertive" : "polite"}
      className="fixed right-4 bottom-4 z-50 flex max-w-sm items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground shadow-lg"
    >
      {failure ? (
        <AlertCircleIcon className="size-4 text-destructive" />
      ) : waiting ? (
        <Spinner className="text-muted-foreground" />
      ) : (
        <CheckIcon className="size-4 text-muted-foreground" />
      )}
      <span className="min-w-0 flex-1">
        {failure
          ? showRpcErrorMessageFromCause(failure.cause)
          : waiting
            ? "Saving changes..."
            : "Changes saved"}
      </span>
      <Button type="button" variant="ghost" size="icon-xs" onClick={reset}>
        <XIcon />
        <span className="sr-only">Dismiss save status</span>
      </Button>
    </div>
  );
}
