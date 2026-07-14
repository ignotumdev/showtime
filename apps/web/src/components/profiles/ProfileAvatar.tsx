import type { Color } from "@showtime/contracts";
import { Avatar } from "@base-ui/react/avatar";
import { cn } from "@/lib/utils";
import { profileColorClassNames } from "./profile-color";

export function ProfileAvatar({
  name,
  color = "neutral",
  className,
}: {
  readonly name: string;
  readonly color?: Color;
  readonly className?: string;
}) {
  const colors = profileColorClassNames[color];
  const initial = Array.from(name.trim())[0]?.toLocaleUpperCase() ?? "?";

  return (
    <Avatar.Root
      aria-hidden="true"
      className={cn(
        "inline-grid size-8 shrink-0 place-items-center overflow-hidden rounded-full text-xs",
        colors.background,
        colors.text,
        className,
      )}
    >
      <Avatar.Fallback className="flex size-full items-center justify-center font-bold leading-none">
        {initial}
      </Avatar.Fallback>
    </Avatar.Root>
  );
}
