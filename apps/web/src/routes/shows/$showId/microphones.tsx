import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { DateTime } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import { AlertCircleIcon, Mic2Icon } from "lucide-react";
import type { ShowId } from "@showtime/contracts";
import { useAtomValue } from "@effect/atom-react";
import { microphoneAtoms, type MicrophoneListItem } from "@/client";
import { MicrophoneCard } from "@/components/microphones/MicrophoneCard";
import { MicrophoneDeleteDialog } from "@/components/microphones/MicrophoneDeleteDialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";

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
              key={`${microphone.id}:${DateTime.toEpochMillis(microphone.updatedAt)}`}
              microphone={microphone}
              microphones={microphones}
              showId={typedShowId}
              onDelete={() => setMicrophoneToDelete(microphone)}
            />
          ))}
        </div>
      )}
      <MicrophoneDeleteDialog
        key={microphoneToDelete?.id ?? "closed"}
        microphone={microphoneToDelete}
        showId={typedShowId}
        onClose={() => setMicrophoneToDelete(undefined)}
      />
    </div>
  );
}
