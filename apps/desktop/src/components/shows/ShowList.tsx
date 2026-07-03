import { AlertCircleIcon, FolderIcon } from "lucide-react";
import { Cause, Option } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ItemGroup } from "@/components/ui/item";
import { useAtomValue } from "@/frontend/react/AtomProvider";
import { showsAtom } from "@/frontend/shows/ShowAtoms";
import { ShowItem } from "./ShowItem";
import { Spinner } from "@/components/ui/spinner";

export function ShowList() {
  const result = useAtomValue(showsAtom);

  if (AsyncResult.isInitial(result)) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Spinner />
          </EmptyMedia>
          <EmptyTitle>Loading shows</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  if (AsyncResult.isFailure(result)) {
    const previous = Option.getOrUndefined(result.previousSuccess);
    if (previous) {
      return <ShowItems shows={previous.value} />;
    }

    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <AlertCircleIcon />
          </EmptyMedia>
          <EmptyTitle>Shows could not be loaded</EmptyTitle>
          <EmptyDescription>{Cause.pretty(result.cause)}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (result.value.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FolderIcon />
          </EmptyMedia>
          <EmptyTitle>No shows yet</EmptyTitle>
          <EmptyDescription>Create a show to get started.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return <ShowItems shows={result.value} />;
}

function ShowItems({
  shows,
}: {
  readonly shows: ReadonlyArray<Parameters<typeof ShowItem>[0]["show"]>;
}) {
  return (
    <ItemGroup>
      {shows.map((show) => (
        <ShowItem key={show.id} show={show} />
      ))}
    </ItemGroup>
  );
}
