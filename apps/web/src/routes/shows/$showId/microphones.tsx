import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertCircleIcon, CheckIcon, Mic2Icon, Trash2Icon } from "lucide-react";
import { Exit } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import {
  colors as colorOptions,
  type MicrophoneNumber,
  type Color,
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
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { microphoneColorClassNames } from "@/components/microphones/microphone-color";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { microphoneAtoms, microphonesRpcReactivityKey, type MicrophoneListItem } from "@/client";
import { rpcErrorMessageFromCause } from "@/client";
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
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col">
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
            <EmptyDescription>Add one to get started</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]">
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
  const edit = useAtomSet(microphoneAtoms(showId).edit, { mode: "promiseExit" });
  const [number, setNumber] = React.useState(String(microphone.number));
  const [name, setName] = React.useState(microphone.name ?? "");
  const [color, setColor] = React.useState(microphone.color);
  const [saveError, setSaveError] = React.useState<string>();
  React.useEffect(() => {
    setNumber(String(microphone.number));
    setName(microphone.name ?? "");
    setColor(microphone.color);
    setSaveError(undefined);
  }, [microphone.color, microphone.name, microphone.number]);

  const save = async (next: { number?: string; name?: string; color?: Color }) => {
    setSaveError(undefined);
    const result = await edit({
      payload: {
        showId,
        id: microphone.id,
        number: ((next.number ?? number.trim()) || microphone.number) as MicrophoneNumber,
        color: next.color ?? color,
        ...(next.name !== undefined
          ? { name: next.name.trim() }
          : name.trim()
            ? { name: name.trim() }
            : {}),
      },
      reactivityKeys: microphonesRpcReactivityKey(showId),
    });
    if (Exit.isFailure(result)) setSaveError(rpcErrorMessageFromCause(result.cause));
    return result;
  };

  const trimmedNumber = number.trim();
  const duplicate = microphones.some(
    (other) => other.id !== microphone.id && other.number.trim() === trimmedNumber,
  );
  const commitNumber = async () => {
    const valid = trimmedNumber || microphone.number;
    setNumber(String(valid));
    if (valid !== microphone.number) {
      const result = await save({ number: valid });
      if (Exit.isFailure(result)) setNumber(String(microphone.number));
    }
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
        className="absolute top-2 right-2 md:opacity-0 md:transition-opacity md:group-hover/card:opacity-100 md:focus-visible:opacity-100"
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
              aria-label="Microphone label"
              value={number}
              onFocus={(event) => event.currentTarget.select()}
              onClick={(event) => {
                event.stopPropagation();
                event.currentTarget.select();
              }}
              onChange={(event) => setNumber(event.currentTarget.value)}
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
              {colorOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-label={option}
                  aria-pressed={option === color}
                  className="relative flex size-8 items-center justify-center rounded-md outline-none ring-ring/50 hover:bg-accent focus-visible:ring-3"
                  onClick={async () => {
                    setColor(option);
                    const result = await save({ color: option });
                    if (Exit.isFailure(result)) setColor(microphone.color);
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
              if (name.trim() !== (microphone.name ?? "")) {
                const result = await save({ name });
                if (Exit.isFailure(result)) setName(microphone.name ?? "");
              }
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
            Label already in use
          </p>
          {saveError && (
            <p role="alert" className="mt-1 text-xs text-destructive">
              {saveError}
            </p>
          )}
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
      setDeleteError(rpcErrorMessageFromCause(result.cause));
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
