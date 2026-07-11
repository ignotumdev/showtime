import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { microphoneColorClassNames } from "@/components/microphones/microphone-color";
import type { LiveSongView } from "@/frontend";
import { cn } from "@/lib/utils";

export function LiveSong({ song }: { readonly song: LiveSongView }) {
  return (
    <main className="mx-auto h-full w-full max-w-5xl overflow-x-hidden overflow-y-auto px-12 pt-6 pb-20 sm:px-16 sm:py-6">
      <div className="flex min-h-full flex-col justify-center">
        <header className="flex shrink-0 flex-col items-center text-center">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-neutral-700 text-2xl font-bold leading-none text-neutral-300">
            {song.position}
          </span>
          <span className="mt-2 min-w-0 max-w-full">
            <h1 className="truncate text-3xl font-semibold tracking-tight sm:text-4xl">
              {song.name}
            </h1>
            {song.artist && <p className="mt-1 truncate text-muted-foreground">{song.artist}</p>}
          </span>
        </header>

        {song.mixes.length > 0 && (
          <section
            aria-label="Mix assignments"
            className="mt-6 grid min-h-0 grid-cols-[repeat(auto-fit,minmax(min(16rem,100%),1fr))] gap-3"
          >
            {song.mixes.map((mix) => {
              const colors = microphoneColorClassNames[mix.color];
              return (
                <Card key={mix.id}>
                  <CardHeader>
                    <CardTitle className="flex min-w-0 items-center justify-between gap-2">
                      <span className="truncate">{mix.name}</span>
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-md font-bold",
                          colors.background,
                          colors.text,
                        )}
                      >
                        {mix.number}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {mix.microphones.map((microphone) => {
                      const colors = microphoneColorClassNames[microphone.color];
                      return (
                        <div key={microphone.id} className="flex items-center gap-2">
                          <span
                            className={cn(
                              "flex size-8 shrink-0 items-center justify-center rounded-md font-bold",
                              colors.background,
                              colors.text,
                            )}
                          >
                            {microphone.number}
                          </span>
                          <span>{microphone.name}</span>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              );
            })}
          </section>
        )}

        {song.notes && (
          <Card className="mt-3">
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap leading-6 text-muted-foreground">{song.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
