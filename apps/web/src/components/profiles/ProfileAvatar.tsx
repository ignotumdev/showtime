import type { Color } from "@showtime/contracts";
import { showContrastColorClassNames } from "@/components/show-contrast-color";
import { cn } from "@/lib/utils";

export function ProfileAvatar({
  name,
  color = "neutral",
  className,
}: {
  readonly name: string;
  readonly color?: Color;
  readonly className?: string;
}) {
  const colors = showContrastColorClassNames[color];
  const initial = Array.from(name.trim())[0]?.toLocaleUpperCase() ?? "?";

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
        colors.background,
        colors.border,
        colors.text,
        className,
      )}
    >
      {initial}
    </span>
  );
}
