import * as React from "react";
import { useAtomSet } from "@effect/atom-react";
import { Exit } from "effect";
import { CheckIcon, Trash2Icon } from "lucide-react";
import {
  colors as colorOptions,
  mainMixId,
  type Color,
  type MixNumber,
  type ShowId,
} from "@showtime/contracts";
import {
  mixAtoms,
  mixesRpcReactivityKey,
  rpcErrorMessageFromCause,
  type MixListItem,
} from "@/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { colorPreviewClassNames } from "@/components/color";
import { microphoneColorClassNames } from "@/components/microphones/microphone-color";
import { cn } from "@/lib/utils";

export function MixCard({
  mix,
  mixes,
  showId,
  onDelete,
}: {
  readonly mix: MixListItem;
  readonly mixes: ReadonlyArray<MixListItem>;
  readonly showId: ShowId;
  readonly onDelete: () => void;
}) {
  const edit = useAtomSet(mixAtoms(showId).edit, { mode: "promiseExit" });
  const [number, setNumber] = React.useState(String(mix.number));
  const [name, setName] = React.useState(mix.name ?? "");
  const [color, setColor] = React.useState(mix.color);
  const [saveError, setSaveError] = React.useState<string>();
  const save = async (next: { number?: string; name?: string; color?: Color }) => {
    setSaveError(undefined);
    const result = await edit({
      payload: {
        showId,
        id: mix.id,
        number: ((next.number ?? number.trim()) || mix.number) as MixNumber,
        color: next.color ?? color,
        ...(next.name !== undefined
          ? { name: next.name.trim() }
          : name.trim()
            ? { name: name.trim() }
            : {}),
      },
      reactivityKeys: mixesRpcReactivityKey(showId),
    });
    if (Exit.isFailure(result)) setSaveError(rpcErrorMessageFromCause(result.cause));
    return result;
  };

  const trimmedNumber = number.trim();
  const duplicate = mixes.some((other) => other.id !== mix.id && other.number === trimmedNumber);
  const commitNumber = async () => {
    const valid = trimmedNumber || mix.number;
    setNumber(String(valid));
    if (valid !== mix.number) {
      const result = await save({ number: valid });
      if (Exit.isFailure(result)) setNumber(String(mix.number));
    }
  };

  const colors = microphoneColorClassNames[color];
  return (
    <Card className="relative">
      {mix.id !== mainMixId && (
        <Button
          type="button"
          variant="destructive"
          size="icon-sm"
          aria-label={`Delete mix ${number}`}
          disabled={mix.pending}
          onClick={onDelete}
          className="absolute top-2 right-2 md:opacity-0 md:transition-opacity md:group-hover/card:opacity-100 md:focus-visible:opacity-100"
        >
          <Trash2Icon />
        </Button>
      )}
      <CardContent className="flex flex-col items-center gap-3 text-center">
        <Popover>
          <PopoverTrigger
            disabled={mix.pending}
            render={
              <div
                className={cn(
                  "flex size-14 shrink-0 items-center justify-center rounded-lg outline-none ring-ring/50 focus-visible:ring-3",
                  colors.background,
                )}
                aria-label={`Change color for mix ${number}`}
              />
            }
          >
            <input
              aria-label="Mix label"
              disabled={mix.pending}
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
                  disabled={mix.pending}
                  className="relative flex size-8 items-center justify-center rounded-md outline-none ring-ring/50 hover:bg-accent focus-visible:ring-3"
                  onClick={async () => {
                    setColor(option);
                    const result = await save({ color: option });
                    if (Exit.isFailure(result)) setColor(mix.color);
                  }}
                >
                  <span className={cn("size-5 rounded-md", colorPreviewClassNames[option])} />
                  {option === color && (
                    <CheckIcon className={cn("absolute size-3 drop-shadow", "text-white")} />
                  )}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <div className="w-full min-w-0">
          <Input
            aria-label={`Name for mix ${number}`}
            disabled={mix.pending}
            placeholder="Optional name"
            value={name}
            className="text-center"
            onChange={(event) => setName(event.currentTarget.value)}
            onBlur={async () => {
              if (name.trim() !== (mix.name ?? "")) {
                const result = await save({ name });
                if (Exit.isFailure(result)) setName(mix.name ?? "");
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
        {mix.id === mainMixId && <Badge>Main mix</Badge>}
      </CardContent>
    </Card>
  );
}
