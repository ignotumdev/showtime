import * as React from "react";
import { CheckIcon } from "lucide-react";
import { colors, type Color } from "@showtime/contracts";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { showColorClassNames } from "@/components/shows/show-color";
import { cn } from "@/lib/utils";

export function ColorPickerPopover({
  color,
  onColorChange,
  trigger,
  children,
}: {
  readonly color: Color;
  readonly onColorChange: (color: Color) => void;
  readonly trigger: React.ReactElement;
  readonly children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);

  const moveSelection = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const direction =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : undefined;

    if (direction === undefined && event.key !== "Home" && event.key !== "End") return;

    event.preventDefault();

    const options = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'),
    );
    const focusedIndex = options.indexOf(document.activeElement as HTMLButtonElement);
    const selectedIndex = colors.indexOf(color);
    const currentIndex = focusedIndex === -1 ? selectedIndex : focusedIndex;
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? options.length - 1
          : (currentIndex + direction! + options.length) % options.length;
    const nextOption = options[nextIndex];

    if (nextOption === undefined) return;

    nextOption.focus();
    onColorChange(colors[nextIndex]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger}>{children}</PopoverTrigger>
      <PopoverContent align="start">
        <div
          role="radiogroup"
          aria-label="Color"
          className="grid grid-cols-6 gap-2"
          onKeyDown={moveSelection}
        >
          {colors.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              className="relative flex size-8 items-center justify-center rounded-md outline-none ring-ring/50 hover:bg-accent focus-visible:ring-3"
              aria-label={option}
              aria-checked={option === color}
              tabIndex={option === color ? 0 : -1}
              onClick={() => {
                onColorChange(option);
                setOpen(false);
              }}
            >
              <span className={cn(showColorClassNames[option], "size-5 rounded-md")} />
              {option === color && <CheckIcon className="absolute size-3 text-white drop-shadow" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
