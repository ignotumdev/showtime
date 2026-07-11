import * as React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

export function LiveSongNavigation({
  previous,
  next,
  onPrevious,
  onNext,
}: {
  readonly previous?: string;
  readonly next?: string;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
}) {
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest("a,button,input,select,textarea,[role='button']")
      )
        return;
      if (event.key === "ArrowLeft" && previous) {
        event.preventDefault();
        onPrevious();
      } else if (event.key === "ArrowRight" && next) {
        event.preventDefault();
        onNext();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [next, onNext, onPrevious, previous]);

  return (
    <nav aria-label="Setlist navigation">
      <div className="fixed bottom-4 left-4 z-20 sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2">
        <Button
          variant="outline"
          size="lg"
          disabled={!previous}
          aria-label={previous ? `Previous song: ${previous}` : "Start of setlist"}
          onClick={onPrevious}
        >
          <ChevronLeftIcon />
          <span className="max-w-40 truncate">{previous ?? "Start"}</span>
        </Button>
      </div>
      <div className="fixed right-4 bottom-4 z-20 sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2">
        <Button
          variant="outline"
          size="lg"
          disabled={!next}
          aria-label={next ? `Next song: ${next}` : "End of setlist"}
          onClick={onNext}
        >
          <span className="max-w-40 truncate">{next ?? "End"}</span>
          <ChevronRightIcon />
        </Button>
      </div>
    </nav>
  );
}
