import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertCircleIcon, CheckIcon, Mic2Icon, Trash2Icon } from "lucide-react";
import { Exit } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import {
  microphonesRpcReactivityKey,
  showColors,
  type MicrophoneNumber,
  type ShowColor,
  type ShowId,
} from "@showtime/contracts";
import { Card, CardContent } from "@/components/ui/card";
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
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { microphoneColorClassNames } from "@/components/shows/show-color";
import { useAtomSet, useAtomValue } from "@/frontend/react/AtomProvider";
import {
  editMicrophoneAtom,
  microphoneAtoms,
  type MicrophoneListItem,
} from "@/frontend/shows/MicrophoneAtoms";
import { showRpcErrorMessageFromCause } from "@/frontend/rpc/errors";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/shows/$showId/microphones")({ component: RouteComponent });

function RouteComponent() {
  const { showId } = Route.useParams();
  const typedShowId = showId as ShowId;
  const microphonesAtom = React.useMemo(
    () => microphoneAtoms(typedShowId).microphones,
    [typedShowId],
  );
  const result = useAtomValue(microphonesAtom);
  const microphones = AsyncResult.isSuccess(result) ? result.value : [];
  const [microphoneToDelete, setMicrophoneToDelete] = React.useState<MicrophoneListItem>();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col">
      {AsyncResult.isInitial(result) ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Spinner />
            </EmptyMedia>
            <EmptyTitle>Loading microphones</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : AsyncResult.isFailure(result) && microphones.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <AlertCircleIcon />
            </EmptyMedia>
            <EmptyTitle>Microphones could not be loaded</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : microphones.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Mic2Icon />
            </EmptyMedia>
            <EmptyTitle>No microphones yet</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3">
          {microphones.map((microphone) => (
            <MicrophoneCard
              key={microphone.id}
              microphone={microphone}
              microphones={microphones}
              showId={typedShowId}
              onDelete={() => setMicrophoneToDelete(microphone)}
            />
          ))}
        </div>
      )}
      <MicrophoneDeleteDialog
        microphone={microphoneToDelete}
        showId={typedShowId}
        onClose={() => setMicrophoneToDelete(undefined)}
      />
    </div>
  );
}

function MicrophoneCard({
  microphone,
  microphones,
  showId,
  onDelete,
}: {
  readonly microphone: MicrophoneListItem;
  readonly microphones: ReadonlyArray<MicrophoneListItem>;
  readonly showId: ShowId;
  readonly onDelete: () => void;
}) {
  const edit = useAtomSet(editMicrophoneAtom, { mode: "promiseExit" });
  const [number, setNumber] = React.useState(String(microphone.number));
  const [name, setName] = React.useState(microphone.name ?? "");
  const [color, setColor] = React.useState(microphone.color);
  React.useEffect(() => {
    setNumber(String(microphone.number));
    setName(microphone.name ?? "");
    setColor(microphone.color);
  }, [microphone.color, microphone.name, microphone.number]);

  const save = (next: { number?: number; name?: string; color?: ShowColor }) =>
    edit({
      payload: {
        showId,
        id: microphone.id,
        number: (next.number ?? (Number(number) || microphone.number)) as MicrophoneNumber,
        color: next.color ?? color,
        ...((next.name ?? name).trim() ? { name: (next.name ?? name).trim() } : {}),
      },
      reactivityKeys: microphonesRpcReactivityKey(showId),
    });

  const parsedNumber = Number(number);
  const duplicate =
    Number.isSafeInteger(parsedNumber) &&
    microphones.some((other) => other.id !== microphone.id && other.number === parsedNumber);
  const commitNumber = async () => {
    const valid =
      Number.isSafeInteger(parsedNumber) && parsedNumber >= 1 ? parsedNumber : microphone.number;
    setNumber(String(valid));
    if (valid !== microphone.number) await save({ number: valid });
  };

  const colors = microphoneColorClassNames[color];
  return (
    <Card className="relative">
      <Button
        type="button"
        variant="destructive"
        size="icon-sm"
        aria-label={`Delete microphone ${number}`}
        disabled={microphone.pending}
        onClick={onDelete}
        className="absolute top-2 right-2 opacity-0 transition-opacity group-hover/card:opacity-100 focus-visible:opacity-100"
      >
        <Trash2Icon />
      </Button>
      <CardContent className="flex flex-col items-center gap-3 text-center">
        <Popover>
          <PopoverTrigger
            render={
              <div
                className={cn(
                  "flex size-14 shrink-0 items-center justify-center rounded-lg outline-none ring-ring/50 focus-visible:ring-3",
                  colors.background,
                )}
                aria-label={`Change color for microphone ${number}`}
              />
            }
          >
            <input
              aria-label="Microphone number"
              inputMode="numeric"
              value={number}
              onFocus={(event) => event.currentTarget.select()}
              onClick={(event) => {
                event.stopPropagation();
                event.currentTarget.select();
              }}
              onChange={(event) => setNumber(event.currentTarget.value.replace(/\D/g, ""))}
              onBlur={commitNumber}
              onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
              className={cn(
                "w-full bg-transparent text-center text-2xl font-bold outline-none",
                colors.text,
              )}
            />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto">
            <div className="grid grid-cols-6 gap-2">
              {showColors.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-label={option}
                  aria-pressed={option === color}
                  className="relative flex size-8 items-center justify-center rounded-md outline-none ring-ring/50 hover:bg-accent focus-visible:ring-3"
                  onClick={async () => {
                    setColor(option);
                    await save({ color: option });
                  }}
                >
                  <span
                    className={cn(
                      "size-5 rounded-md",
                      microphoneColorClassNames[option].background,
                    )}
                  />
                  {option === color && (
                    <CheckIcon
                      className={cn(
                        "absolute size-3 drop-shadow",
                        microphoneColorClassNames[option].text,
                      )}
                    />
                  )}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <div className="w-full min-w-0">
          <Input
            aria-label={`Name for microphone ${number}`}
            placeholder="Optional name"
            value={name}
            className="text-center"
            onChange={(event) => setName(event.currentTarget.value)}
            onBlur={async () => {
              if (name.trim() !== (microphone.name ?? "")) await save({ name });
            }}
            onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
          />
          <p
            className={cn(
              "mt-1 text-xs",
              duplicate ? "text-amber-600 dark:text-amber-400" : "invisible",
            )}
            role={duplicate ? "alert" : undefined}
          >
            Number already in use
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function MicrophoneDeleteDialog({
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

  React.useEffect(() => {
    setIsDeleting(false);
    setDeleteError(undefined);
  }, [microphone]);

  const confirmDelete = async () => {
    if (!microphone) return;
    setIsDeleting(true);
    setDeleteError(undefined);
    const result = await deleteMicrophone({
      payload: { showId, id: microphone.id },
      reactivityKeys: microphonesRpcReactivityKey(showId),
    });
    if (Exit.isSuccess(result)) {
      onClose();
    } else {
      setDeleteError(showRpcErrorMessageFromCause(result.cause));
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
          <DialogTitle>Delete microphone?</DialogTitle>
          <DialogDescription>
            This will permanently delete {label}. This cannot be undone.
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
            <Trash2Icon /> {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
