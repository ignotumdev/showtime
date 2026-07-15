import type { ChatMessagePart } from "@showtime/contracts";
import { Mic2Icon, SpeakerIcon } from "lucide-react";
import { microphoneColorClassNames } from "@/components/microphones/microphone-color";
import { cn } from "@/lib/utils";

export function ChatMessageBody({
  body,
  parts,
}: {
  readonly body: string;
  readonly parts?: ReadonlyArray<ChatMessagePart>;
}) {
  if (!parts?.length) return body;
  let characterOffset = 0;
  return parts.map((part) => {
    const key = `${part.type}:${characterOffset}:${part.text}`;
    characterOffset += part.text.length;
    if (part.type === "text") return <span key={key}>{part.text}</span>;
    const colors = microphoneColorClassNames[part.color];
    const label = part.type === "microphone" ? "Microphone" : "Mix";
    const Icon = part.type === "microphone" ? Mic2Icon : SpeakerIcon;
    return (
      <span
        key={key}
        className="mx-0.5 inline-flex max-w-full translate-y-px items-center gap-1 rounded-md border bg-background/80 py-0.5 pr-1.5 pl-0.5 align-baseline text-xs font-medium text-foreground"
        aria-label={`${label} ${part.number}${part.name ? `, ${part.name}` : ""}`}
        title={part.name || `${label} ${part.number}`}
      >
        <span
          className={cn(
            "inline-flex min-w-6 shrink-0 items-center justify-center rounded px-1 py-0.5 font-bold",
            colors.background,
            colors.text,
          )}
          aria-hidden="true"
        >
          {part.number}
        </span>
        <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        {part.name && <span className="truncate">{part.name}</span>}
      </span>
    );
  });
}
