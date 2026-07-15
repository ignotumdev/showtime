import { createFileRoute } from "@tanstack/react-router";
import { DateTime } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import { AlertCircleIcon } from "lucide-react";
import type { ShowId } from "@showtime/contracts";
import { useAtomValue } from "@effect/atom-react";
import { microphoneAtoms, mixAtoms, songAtoms } from "@/client";
import { SongDetail } from "@/components/songs/SongDetail";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";

export const Route = createFileRoute("/shows/$showId/setlist/$songId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { showId, songId } = Route.useParams();
  const typedShowId = showId as ShowId;
  const songsResult = useAtomValue(songAtoms(typedShowId).songs);
  const mixesResult = useAtomValue(mixAtoms(typedShowId).mixes);
  const microphonesResult = useAtomValue(microphoneAtoms(typedShowId).microphones);
  const songs = AsyncResult.getOrElse(songsResult, () => []);
  const songIndex = songs.findIndex((song) => song.id === songId);
  const song = songs[songIndex];
  const mixes = AsyncResult.isSuccess(mixesResult) ? mixesResult.value : [];
  const microphones = AsyncResult.isSuccess(microphonesResult) ? microphonesResult.value : [];

  if (AsyncResult.isInitial(songsResult)) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Spinner />
          </EmptyMedia>
          <EmptyTitle>Loading song</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }
  if (AsyncResult.isFailure(songsResult) && songs.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <AlertCircleIcon />
          </EmptyMedia>
          <EmptyTitle>Song could not be loaded</EmptyTitle>
          <EmptyDescription>Check your connection and try again.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  if (!song) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <AlertCircleIcon />
          </EmptyMedia>
          <EmptyTitle>Song not found</EmptyTitle>
          <EmptyDescription>It may have been removed from the setlist.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <SongDetail
      key={`${song.id}:${DateTime.toEpochMillis(song.updatedAt)}`}
      showId={typedShowId}
      song={song}
      number={songIndex + 1}
      mixes={mixes}
      microphones={microphones}
    />
  );
}
