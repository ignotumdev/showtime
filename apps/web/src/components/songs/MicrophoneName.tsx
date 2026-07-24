import * as React from "react";
import type { Microphone, SongMicrophoneName } from "@showtime/contracts";
import { Input } from "@/components/ui/input";

export function MicrophoneName({
  microphone,
  microphoneNames,
  disabled,
  onSave,
}: {
  readonly microphone: Microphone;
  readonly microphoneNames: ReadonlyArray<SongMicrophoneName>;
  readonly disabled: boolean;
  readonly onSave: (value: string) => void;
}) {
  const inheritedName = microphone.name ?? "";
  const displayedName =
    microphoneNames.find((item) => item.microphoneId === microphone.id)?.name ?? inheritedName;
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(displayedName);

  React.useEffect(() => setValue(displayedName), [displayedName]);

  if (!editing) {
    return (
      <button
        type="button"
        className="block w-full truncate text-center text-sm font-medium"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          setValue(displayedName);
          setEditing(true);
        }}
        onKeyDown={(event) => event.stopPropagation()}
      >
        {displayedName || "Add name"}
      </button>
    );
  }

  return (
    <Input
      autoFocus
      aria-label={`Name override for microphone ${microphone.number}`}
      value={value}
      disabled={disabled}
      onChange={(event) => setValue(event.currentTarget.value)}
      onBlur={() => {
        setEditing(false);
        if (value.trim() !== displayedName) onSave(value);
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setValue(displayedName);
          setEditing(false);
        }
      }}
      onClick={(event) => event.stopPropagation()}
      className="h-auto min-w-0 border-transparent bg-transparent p-0 text-center text-base leading-none font-medium shadow-none focus-visible:bg-input/30 focus-visible:ring-0 dark:bg-transparent dark:focus-visible:bg-input/30"
    />
  );
}
