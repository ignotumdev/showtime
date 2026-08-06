import * as React from "react";
import { useAtomSet } from "@effect/atom-react";
import { Exit } from "effect";
import { useNavigate } from "@tanstack/react-router";
import { ChevronsUpDownIcon, Trash2Icon } from "lucide-react";
import type { Color, ShowName } from "@showtime/contracts";
import {
  editShowAtom,
  rpcErrorMessageFromCause,
  showDialogAtom,
  showMutationOptions,
} from "@/client";
import { useShowFromParams } from "@/hooks/useShowFromParams";
import { SettingsHeader, SettingsItem, SettingsSection } from "@/components/settings/SettingsPage";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ColorPickerPopover } from "@/components/ColorPickerPopover";
import { showColorClassNames } from "@/components/shows/show-color";
import { ShowDeleteDialog } from "@/components/shows/ShowDeleteDialog";
import { cn } from "@/lib/utils";

export function GeneralSettings() {
  const { show } = useShowFromParams();
  const navigate = useNavigate();
  const editShow = useAtomSet(editShowAtom, { mode: "promiseExit" });
  const setDialog = useAtomSet(showDialogAtom);
  const [name, setName] = React.useState(show?.name ?? "");
  const [color, setColor] = React.useState<Color>(show?.color ?? "neutral");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const saveQueue = React.useRef(Promise.resolve());
  const pendingSaves = React.useRef(0);
  const suppressNextBlurSave = React.useRef(false);

  React.useEffect(() => {
    if (!show) return;
    setName(show.name);
    setColor(show.color);
  }, [show]);

  if (!show) {
    return (
      <div className="space-y-6">
        <SettingsHeader>General</SettingsHeader>
        <p className="text-sm text-muted-foreground">This show could not be found.</p>
      </div>
    );
  }

  const save = (nextName: string, nextColor: Color) => {
    const trimmed = nextName.trim();
    if (!trimmed) {
      setName(show.name);
      return;
    }
    if (trimmed === show.name && nextColor === show.color) return;
    pendingSaves.current += 1;
    setSaving(true);
    setError(undefined);
    saveQueue.current = saveQueue.current
      .then(async () => {
        const result = await editShow({
          payload: { id: show.id, name: trimmed as ShowName, color: nextColor },
          ...showMutationOptions,
        });
        if (Exit.isFailure(result)) setError(rpcErrorMessageFromCause(result.cause));
      })
      .finally(() => {
        pendingSaves.current -= 1;
        if (pendingSaves.current === 0) setSaving(false);
      });
  };

  return (
    <div className="space-y-6">
      <SettingsHeader>General</SettingsHeader>
      <div className="space-y-4">
        <SettingsSection title="General">
          <SettingsItem
            title="Show name"
            description="The name shown throughout Showtime."
            action={
              <Input
                aria-label="Show name"
                className="w-auto min-w-24 max-w-full [field-sizing:content]"
                size={Math.max(8, Math.min(40, name.length + 2))}
                value={name}
                maxLength={80}
                onChange={(event) => setName(event.currentTarget.value)}
                onBlur={() => {
                  if (suppressNextBlurSave.current) {
                    suppressNextBlurSave.current = false;
                    return;
                  }
                  save(name, color);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                  if (event.key === "Escape") {
                    suppressNextBlurSave.current = true;
                    setName(show.name);
                    event.currentTarget.blur();
                  }
                }}
              />
            }
          />
          <SettingsItem
            title="Show color"
            description="Used to identify this show at a glance."
            action={
              <ColorPickerPopover
                color={color}
                onColorChange={(nextColor) => {
                  setColor(nextColor);
                  save(name, nextColor);
                }}
                trigger={<Button type="button" variant="outline" className="w-full sm:w-40" />}
              >
                <span className={cn(showColorClassNames[color], "size-4 rounded")} />
                <span className="capitalize">{color}</span>
                <ChevronsUpDownIcon className="ml-auto" />
              </ColorPickerPopover>
            }
          />
        </SettingsSection>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {saving && <p className="text-xs text-muted-foreground">Saving…</p>}
      </div>

      <SettingsSection title="Danger zone">
        <SettingsItem
          title="Delete show"
          description="Remove this show and all of its songs, chat, microphones, and mixes."
          action={
            <Button variant="destructive" onClick={() => setDialog({ type: "delete", show })}>
              <Trash2Icon /> Delete show
            </Button>
          }
        />
      </SettingsSection>
      <ShowDeleteDialog onDeleted={() => navigate({ to: "/" })} />
    </div>
  );
}
