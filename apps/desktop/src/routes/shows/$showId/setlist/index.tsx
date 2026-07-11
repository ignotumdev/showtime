import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AsyncResult } from "effect/unstable/reactivity";
import { Exit } from "effect";
import { AlertCircleIcon, GripVerticalIcon, ListMusicIcon } from "lucide-react";
import type { ShowId, SongId } from "@showtime/contracts";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { songAtoms, songsRpcReactivityKey, type SongListItem } from "@/frontend";
import { rpcErrorMessageFromCause } from "@/frontend";

export const Route = createFileRoute("/shows/$showId/setlist/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { showId } = Route.useParams();
  const typedShowId = showId as ShowId;
  const result = useAtomValue(songAtoms(typedShowId).songs);
  const reorder = useAtomSet(songAtoms(typedShowId).reorder, { mode: "promiseExit" });
  const songs = AsyncResult.isSuccess(result) ? result.value : [];
  const [previewSongs, setPreviewSongs] = React.useState<ReadonlyArray<SongListItem>>(songs);
  const [draggedId, setDraggedId] = React.useState<SongId>();
  const didDropRef = React.useRef(false);
  const [isReordering, setIsReordering] = React.useState(false);
  const [announcement, setAnnouncement] = React.useState("");
  const [error, setError] = React.useState<string>();

  React.useEffect(() => {
    if (!draggedId) setPreviewSongs(songs);
  }, [songs, draggedId]);

  const commitOrder = async (ordered: ReadonlyArray<SongListItem>, movedName: string) => {
    setIsReordering(true);
    setError(undefined);
    const mutation = await reorder({
      payload: { showId: typedShowId, orderedSongIds: ordered.map((song) => song.id) },
      reactivityKeys: songsRpcReactivityKey(typedShowId),
    });
    if (Exit.isFailure(mutation)) {
      const message = rpcErrorMessageFromCause(mutation.cause);
      setError(message);
      setAnnouncement(`Could not move ${movedName}. ${message}`);
    }
    setIsReordering(false);
  };

  const move = (id: SongId, destination: number) => {
    const current = previewSongs.findIndex((song) => song.id === id);
    if (current < 0 || current === destination || isReordering) return;
    const ordered = [...previewSongs];
    const [moved] = ordered.splice(current, 1);
    if (!moved) return;
    ordered.splice(destination, 0, moved);
    setAnnouncement(`${moved.name} moved to position ${destination + 1}.`);
    void commitOrder(ordered, moved.name);
  };

  const previewMove = (id: SongId, destination: number) => {
    setPreviewSongs((currentSongs) => {
      const current = currentSongs.findIndex((song) => song.id === id);
      if (current < 0 || current === destination) return currentSongs;
      const ordered = [...currentSongs];
      const [moved] = ordered.splice(current, 1);
      if (!moved) return currentSongs;
      ordered.splice(destination, 0, moved);
      return ordered;
    });
  };

  const commitDrag = () => {
    if (!draggedId) return;
    didDropRef.current = true;
    const moved = previewSongs.find((song) => song.id === draggedId);
    const changed = previewSongs.some((song, index) => song.id !== songs[index]?.id);
    setDraggedId(undefined);
    if (moved && changed) {
      setAnnouncement(`${moved.name} moved to position ${previewSongs.indexOf(moved) + 1}.`);
      void commitOrder(previewSongs, moved.name);
    }
  };

  const cancelDrag = () => {
    if (didDropRef.current) {
      didDropRef.current = false;
      return;
    }
    setDraggedId(undefined);
    setPreviewSongs(songs);
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-4xl flex-col gap-4">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {AsyncResult.isInitial(result) ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Spinner />
            </EmptyMedia>
            <EmptyTitle>Loading songs</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : AsyncResult.isFailure(result) && songs.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <AlertCircleIcon />
            </EmptyMedia>
            <EmptyTitle>Songs could not be loaded</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : songs.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ListMusicIcon />
            </EmptyMedia>
            <EmptyTitle>No songs yet</EmptyTitle>
            <EmptyDescription>Add the first song to start building the setlist.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
          {previewSongs.map((song, index) => (
            <div
              key={song.id}
              onDragOver={(event) => {
                event.preventDefault();
                if (draggedId) previewMove(draggedId, index);
              }}
              onDrop={(event) => {
                event.preventDefault();
                commitDrag();
              }}
              className="group flex min-h-16 items-center border-b transition-[background-color,opacity,transform] last:border-b-0 hover:bg-accent/50"
            >
              <button
                type="button"
                draggable={!isReordering && !("pending" in song && song.pending)}
                disabled={isReordering || ("pending" in song && song.pending === true)}
                aria-label={`Move ${song.name}. Position ${index + 1} of ${songs.length}. Use arrow keys to reorder.`}
                onDragStart={(event) => {
                  didDropRef.current = false;
                  setPreviewSongs(songs);
                  setDraggedId(song.id);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", song.id);
                }}
                onDragEnd={cancelDrag}
                onKeyDown={(event) => {
                  if (event.key === "ArrowUp" && index > 0) {
                    event.preventDefault();
                    move(song.id, index - 1);
                  }
                  if (event.key === "ArrowDown" && index < songs.length - 1) {
                    event.preventDefault();
                    move(song.id, index + 1);
                  }
                }}
                className="ml-2 rounded-md p-1 text-muted-foreground outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <GripVerticalIcon className="size-5" />
              </button>
              <Link
                to="/shows/$showId/setlist/$songId"
                params={{ showId, songId: song.id }}
                className="flex min-w-0 flex-1 items-center gap-3 px-2 py-3 outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-neutral-700 text-sm font-bold text-neutral-300">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{song.name || "New song"}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {song.artist}
                  </span>
                </span>
              </Link>
            </div>
          ))}
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
