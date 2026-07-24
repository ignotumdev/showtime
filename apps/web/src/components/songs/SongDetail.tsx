import * as React from "react";
import { Exit } from "effect";
import { EllipsisIcon, Trash2Icon } from "lucide-react";
import {
  type Microphone,
  type MicrophoneId,
  type Mix,
  type ShowId,
  type Song,
  type SongArtist,
  type SongMicrophoneName,
  type SongMixAssignment,
  type SongName,
} from "@showtime/contracts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAtomSet } from "@effect/atom-react";
import { songAtoms, songsRpcReactivityKey } from "@/client";
import { rpcErrorMessageFromCause } from "@/client";
import { SongDeleteDialog } from "./SongDeleteDialog";
import { SongMixAssignments } from "./SongMixAssignments";

type SongDetailState = {
  readonly name: string;
  readonly artist: string;
  readonly notes: string;
  readonly assignments: ReadonlyArray<SongMixAssignment>;
  readonly microphoneNames: ReadonlyArray<SongMicrophoneName>;
  readonly isSaving: boolean;
  readonly saveError?: string;
  readonly deleteOpen: boolean;
};

const reduceSongDetailState = (
  state: SongDetailState,
  update: Partial<SongDetailState>,
): SongDetailState => ({ ...state, ...update });

export function SongDetail({
  showId,
  song,
  number,
  mixes,
  microphones,
}: {
  readonly showId: ShowId;
  readonly song: Song;
  readonly number: number;
  readonly mixes: ReadonlyArray<Mix>;
  readonly microphones: ReadonlyArray<Microphone>;
}) {
  const edit = useAtomSet(songAtoms(showId).edit, { mode: "promiseExit" });
  const [
    { name, artist, notes, assignments, microphoneNames, isSaving, saveError, deleteOpen },
    update,
  ] = React.useReducer(reduceSongDetailState, {
    name: song.name,
    artist: song.artist,
    notes: song.notes ?? "",
    assignments: song.mixAssignments,
    microphoneNames: song.microphoneNames ?? [],
    isSaving: false,
    deleteOpen: false,
  });
  const isSavingRef = React.useRef(false);
  const notesRef = React.useRef<HTMLTextAreaElement>(null);
  React.useLayoutEffect(() => {
    const textarea = notesRef.current;
    if (!textarea) return;

    const styles = window.getComputedStyle(textarea);
    const lineHeight = Number.parseFloat(styles.lineHeight);
    const verticalChrome =
      Number.parseFloat(styles.paddingTop) +
      Number.parseFloat(styles.paddingBottom) +
      Number.parseFloat(styles.borderTopWidth) +
      Number.parseFloat(styles.borderBottomWidth);
    const maxHeight = lineHeight * 6 + verticalChrome;

    textarea.style.maxHeight = `${maxHeight}px`;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  }, [notes]);

  const save = async (
    next?: {
      readonly name?: string;
      readonly artist?: string;
      readonly notes?: string;
      readonly assignments?: ReadonlyArray<SongMixAssignment>;
      readonly microphoneNames?: ReadonlyArray<SongMicrophoneName>;
    },
    blockUi = true,
  ) => {
    const nextName = (next?.name ?? name).trim();
    const nextArtist = (next?.artist ?? artist).trim();
    if (blockUi && isSavingRef.current) return false;
    const activeMixIds = new Set(mixes.map((mix) => mix.id));
    const activeMicrophoneIds = new Set(microphones.map((microphone) => microphone.id));
    const normalizedAssignments = (next?.assignments ?? assignments).flatMap((assignment) => {
      if (!activeMixIds.has(assignment.mixId)) return [];
      const microphoneIds = assignment.microphoneIds.filter((id) => activeMicrophoneIds.has(id));
      return microphoneIds.length > 0 ? [{ ...assignment, microphoneIds }] : [];
    });
    const normalizedMicrophoneNames = (next?.microphoneNames ?? microphoneNames).filter((item) =>
      activeMicrophoneIds.has(item.microphoneId),
    );
    if (blockUi) {
      isSavingRef.current = true;
      update({ isSaving: true });
    }
    update({ saveError: undefined });
    const result = await edit({
      payload: {
        showId,
        id: song.id,
        name: nextName as SongName,
        artist: nextArtist as SongArtist,
        notes: next?.notes ?? notes,
        mixAssignments: normalizedAssignments,
        microphoneNames: normalizedMicrophoneNames,
      },
      reactivityKeys: songsRpcReactivityKey(showId),
    });
    if (blockUi) {
      isSavingRef.current = false;
      update({ isSaving: false });
    }
    if (Exit.isFailure(result)) {
      update({
        saveError: rpcErrorMessageFromCause(result.cause),
        name: song.name,
        artist: song.artist,
        notes: song.notes ?? "",
        assignments: song.mixAssignments,
        microphoneNames: song.microphoneNames ?? [],
      });
      return false;
    }
    return true;
  };

  const toggleMicrophone = (mixId: Mix["id"], microphoneId: MicrophoneId) => {
    if (isSavingRef.current) return;
    const existing = assignments.find((assignment) => assignment.mixId === mixId);
    const selected = new Set(existing?.microphoneIds ?? []);
    if (selected.has(microphoneId)) {
      selected.delete(microphoneId);
    } else {
      selected.add(microphoneId);
    }
    const microphoneIds = microphones.reduce<Array<MicrophoneId>>((ids, microphone) => {
      if (selected.has(microphone.id)) ids.push(microphone.id);
      return ids;
    }, []);
    const next = [
      ...assignments.filter((assignment) => assignment.mixId !== mixId),
      ...(microphoneIds.length ? [{ mixId, microphoneIds }] : []),
    ];
    update({ assignments: next });
    void save({ assignments: next });
  };

  const saveMicrophoneName = (microphone: Microphone, value: string) => {
    const trimmed = value.trim();
    const override = trimmed && trimmed !== (microphone.name?.trim() ?? "") ? trimmed : undefined;
    const nextMicrophoneNames = [
      ...microphoneNames.filter((item) => item.microphoneId !== microphone.id),
      ...(override ? [{ microphoneId: microphone.id, name: override }] : []),
    ];
    update({ microphoneNames: nextMicrophoneNames });
    void save({ microphoneNames: nextMicrophoneNames }, false);
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <div className="flex items-start gap-2 pb-2 sm:gap-3 sm:pb-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-neutral-700 text-lg font-bold leading-none text-neutral-300">
          {number}
        </div>
        <div className="grid min-w-0 flex-1 gap-1">
          <div className="flex min-w-0 flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2">
            <Input
              aria-label="Song name"
              placeholder="New song"
              value={name}
              disabled={isSaving}
              onChange={(event) => update({ name: event.currentTarget.value })}
              onBlur={() => {
                if (name.trim() !== song.name) void save({ name });
              }}
              onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
              className="h-auto w-full min-w-0 max-w-full border-transparent bg-transparent px-2 py-1 text-xl font-semibold shadow-none focus-visible:bg-input/30 disabled:bg-transparent disabled:opacity-100 sm:w-auto sm:shrink sm:text-2xl sm:[field-sizing:content] dark:bg-transparent dark:disabled:bg-transparent dark:focus-visible:bg-input/30"
            />
            <Badge
              variant="outline"
              className="ml-2 min-w-0 max-w-[calc(100%-0.5rem)] shrink sm:ml-0 sm:max-w-64"
            >
              <Input
                aria-label="Artist"
                placeholder="Artist"
                value={artist}
                disabled={isSaving}
                onChange={(event) => update({ artist: event.currentTarget.value })}
                onBlur={() => {
                  if (artist.trim() !== song.artist) void save({ artist });
                }}
                onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
                className="h-auto min-w-0 max-w-full w-auto border-0 bg-transparent p-0 text-base leading-none shadow-none [field-sizing:content] focus-visible:ring-0 disabled:bg-transparent disabled:opacity-100 dark:bg-transparent dark:disabled:bg-transparent"
              />
            </Badge>
          </div>
          <Textarea
            ref={notesRef}
            aria-label="Song notes"
            value={notes}
            disabled={isSaving}
            placeholder="Notes"
            rows={1}
            onChange={(event) => update({ notes: event.currentTarget.value })}
            onBlur={() => {
              if (notes.trim() !== (song.notes ?? "")) void save({ notes });
            }}
            className="min-h-0 resize-none overflow-y-auto border-transparent bg-transparent shadow-none focus-visible:bg-input/30 disabled:bg-transparent disabled:opacity-100 dark:bg-transparent dark:disabled:bg-transparent dark:focus-visible:bg-input/30"
          />
          {saveError && (
            <p role="alert" className="px-2 text-xs text-destructive">
              {saveError}
            </p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon" aria-label="Song actions" />}
          >
            <EllipsisIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem variant="destructive" onClick={() => update({ deleteOpen: true })}>
              <Trash2Icon /> Delete song
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <SongMixAssignments
        mixes={mixes}
        microphones={microphones}
        assignments={assignments}
        microphoneNames={microphoneNames}
        disabled={isSaving}
        onToggleMicrophone={toggleMicrophone}
        onSaveMicrophoneName={saveMicrophoneName}
      />
      <SongDeleteDialog
        key={deleteOpen ? song.id : "closed"}
        showId={showId}
        songId={song.id}
        songName={song.name}
        open={deleteOpen}
        onOpenChange={(open) => update({ deleteOpen: open })}
      />
    </div>
  );
}
