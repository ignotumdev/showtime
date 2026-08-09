import type * as React from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export function NewChatChannelInput({
  name,
  busy,
  onNameChange,
  onSubmit,
  className,
  formClassName,
}: {
  readonly name: string;
  readonly busy: boolean;
  readonly onNameChange: (name: string) => void;
  readonly onSubmit: React.FormEventHandler<HTMLFormElement>;
  readonly className?: string;
  readonly formClassName?: string;
}) {
  return (
    <form className={cn("shrink-0", formClassName)} onSubmit={onSubmit}>
      <InputGroup className={cn("w-56", className)}>
        <InputGroupAddon>
          <InputGroupText>#</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput
          aria-label="New channel name"
          className="pl-0!"
          value={name}
          maxLength={60}
          placeholder="New channel"
          disabled={busy}
          onChange={(event) => onNameChange(event.currentTarget.value)}
        />
        {name.length > 0 && (
          <InputGroupAddon align="inline-end">
            <InputGroupButton type="submit" variant="default" disabled={!name.trim() || busy}>
              {busy ? <Spinner /> : "Add"}
            </InputGroupButton>
          </InputGroupAddon>
        )}
      </InputGroup>
    </form>
  );
}
