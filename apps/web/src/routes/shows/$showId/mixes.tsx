import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { DateTime } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import { AlertCircleIcon, SpeakerIcon } from "lucide-react";
import type { ShowId } from "@showtime/contracts";
import { useAtomValue } from "@effect/atom-react";
import { mixAtoms, type MixListItem } from "@/client";
import { MixCard } from "@/components/mixes/MixCard";
import { MixDeleteDialog } from "@/components/mixes/MixDeleteDialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";

export const Route = createFileRoute("/shows/$showId/mixes")({ component: RouteComponent });

function RouteComponent() {
  const { showId } = Route.useParams();
  const typedShowId = showId as ShowId;
  const mixesAtom = React.useMemo(() => mixAtoms(typedShowId).mixes, [typedShowId]);
  const result = useAtomValue(mixesAtom);
  const mixes = AsyncResult.isSuccess(result) ? result.value : [];
  const [mixToDelete, setMixToDelete] = React.useState<MixListItem>();

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col">
      {AsyncResult.isInitial(result) ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Spinner />
            </EmptyMedia>
            <EmptyTitle>Loading mixes</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : AsyncResult.isFailure(result) && mixes.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <AlertCircleIcon />
            </EmptyMedia>
            <EmptyTitle>Mixes could not be loaded</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : mixes.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SpeakerIcon />
            </EmptyMedia>
            <EmptyTitle>No mixes yet</EmptyTitle>
            <EmptyDescription>Add one to get started</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]">
          {mixes.map((mix) => (
            <MixCard
              key={`${mix.id}:${DateTime.toEpochMillis(mix.updatedAt)}`}
              mix={mix}
              mixes={mixes}
              showId={typedShowId}
              onDelete={() => setMixToDelete(mix)}
            />
          ))}
        </div>
      )}
      <MixDeleteDialog
        key={mixToDelete?.id ?? "closed"}
        mix={mixToDelete}
        showId={typedShowId}
        onClose={() => setMixToDelete(undefined)}
      />
    </div>
  );
}
