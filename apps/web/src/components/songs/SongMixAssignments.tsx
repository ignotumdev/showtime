import { MusicIcon } from "lucide-react";
import {
  mainMixId,
  type Microphone,
  type MicrophoneId,
  type Mix,
  type SongMicrophoneName,
  type SongMixAssignment,
} from "@showtime/contracts";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { microphoneColorClassNames } from "@/components/microphones/microphone-color";
import { cn } from "@/lib/utils";
import { MicrophoneName } from "./MicrophoneName";

export function SongMixAssignments({
  mixes,
  microphones,
  assignments,
  microphoneNames,
  disabled,
  onToggleMicrophone,
  onSaveMicrophoneName,
}: {
  readonly mixes: ReadonlyArray<Mix>;
  readonly microphones: ReadonlyArray<Microphone>;
  readonly assignments: ReadonlyArray<SongMixAssignment>;
  readonly microphoneNames: ReadonlyArray<SongMicrophoneName>;
  readonly disabled: boolean;
  readonly onToggleMicrophone: (mixId: Mix["id"], microphoneId: MicrophoneId) => void;
  readonly onSaveMicrophoneName: (microphone: Microphone, value: string) => void;
}) {
  const orderedMixes = [...mixes].sort(
    (left, right) => Number(right.id === mainMixId) - Number(left.id === mainMixId),
  );
  const hasUnpairedMix = orderedMixes.filter((mix) => mix.id !== mainMixId).length % 2 === 1;

  return (
    <Tabs defaultValue="mixes">
      <TabsList variant="line">
        <TabsTrigger value="mixes">Mixes</TabsTrigger>
      </TabsList>
      <TabsContent value="mixes">
        {mixes.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MusicIcon />
              </EmptyMedia>
              <EmptyTitle>No mixes available</EmptyTitle>
              <EmptyDescription>Add a mix before assigning microphones.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {orderedMixes.map((mix, index) => {
              const assignment = assignments.find((item) => item.mixId === mix.id);
              const selected = new Set(assignment?.microphoneIds ?? []);
              return (
                <Card
                  key={mix.id}
                  className={cn(
                    (mix.id === mainMixId ||
                      (hasUnpairedMix && index === orderedMixes.length - 1)) &&
                      "md:col-span-2",
                  )}
                >
                  <CardHeader className="items-center gap-x-3">
                    <CardAction>
                      <Badge variant="outline">
                        {selected.size} {selected.size === 1 ? "mic" : "mics"} on
                      </Badge>
                    </CardAction>
                    <CardTitle className="flex min-w-0 items-center gap-2">
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-md font-bold",
                          microphoneColorClassNames[mix.color].background,
                          microphoneColorClassNames[mix.color].text,
                        )}
                      >
                        {mix.number}
                      </span>
                      <span className="truncate">
                        {mix.name || (mix.id === mainMixId ? "Main mix" : "Mix")}
                      </span>
                      {mix.id === mainMixId && <Badge>Main mix</Badge>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-2 min-[480px]:grid-cols-[repeat(auto-fill,7rem)]">
                    {microphones.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No microphones available.</p>
                    ) : (
                      microphones.map((microphone) => {
                        const active = selected.has(microphone.id);
                        const colors = microphoneColorClassNames[microphone.color];
                        return (
                          <div
                            key={microphone.id}
                            className={cn(
                              "relative flex h-20 w-full min-w-0 flex-col items-center justify-center gap-1 rounded-lg border bg-muted/50 px-2 py-2 text-center text-foreground transition-colors min-[480px]:w-28 min-[480px]:px-3",
                              !active && "hover:bg-muted",
                              active && colors.background,
                              active && colors.text,
                              active && colors.border,
                              active && "border-2",
                            )}
                          >
                            <button
                              type="button"
                              aria-label={`${active ? "Remove" : "Add"} microphone ${microphone.number} ${active ? "from" : "to"} ${mix.name || `mix ${mix.number}`}`}
                              aria-pressed={active}
                              disabled={disabled}
                              onClick={() => onToggleMicrophone(mix.id, microphone.id)}
                              className="absolute inset-0 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
                            />
                            <span
                              className={cn(
                                "pointer-events-none relative z-10 text-lg font-bold",
                                !active && colors.text,
                              )}
                            >
                              {microphone.number}
                            </span>
                            <div className="relative z-10 w-full min-w-0">
                              <MicrophoneName
                                microphone={microphone}
                                microphoneNames={microphoneNames}
                                disabled={disabled}
                                onSave={(value) => onSaveMicrophoneName(microphone, value)}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
