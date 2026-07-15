import * as React from "react";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Exit } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import {
  chatPresetPlaceholderNames,
  chatsSyncKey,
  resolveChatPresetTemplate,
  validateChatPresetDefinition,
  type ChatMessagePart,
  type ChatPreset,
  type ChatPresetField,
  type ChatPresetName,
  type ChatPresetTemplate,
  type Microphone,
  type Mix,
  type ProfileId,
  type ShowId,
} from "@showtime/contracts";
import {
  ArrowLeftIcon,
  ArrowUpIcon,
  EllipsisIcon,
  FilePlus2Icon,
  LibraryIcon,
  Mic2Icon,
  PencilIcon,
  SpeakerIcon,
  Trash2Icon,
} from "lucide-react";
import { chatAtoms, microphoneAtoms, mixAtoms, rpcErrorMessageFromCause } from "@/client";
import { ChatMessageBody } from "@/components/chats/ChatMessageBody";
import { colorPreviewClassNames } from "@/components/color";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

type Mode =
  | { readonly type: "list" }
  | { readonly type: "use"; readonly preset: ChatPreset }
  | { readonly type: "edit"; readonly preset?: ChatPreset }
  | { readonly type: "delete"; readonly preset: ChatPreset };

const fieldTypeLabels: Record<ChatPresetField["type"], string> = {
  microphone: "Microphone",
  mix: "Mix",
  text: "Text",
  number: "Number",
  select: "Options",
};

const readableFieldName = (name: string) =>
  name.replace(/[-_]+/g, " ").replace(/^./, (letter: string) => letter.toUpperCase());

function ChannelIdentity({
  channel,
}: {
  readonly channel: Pick<Microphone, "color" | "number"> | Pick<Mix, "color" | "number">;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className={`size-2.5 shrink-0 rounded-full ${colorPreviewClassNames[channel.color]}`}
      />
      <span>{channel.number}</span>
    </span>
  );
}

function ChannelSelectValue({
  channel,
  placeholder,
}: {
  readonly channel:
    | Pick<Microphone, "color" | "number">
    | Pick<Mix, "color" | "number">
    | undefined;
  readonly placeholder: string;
}) {
  return channel ? <ChannelIdentity channel={channel} /> : placeholder;
}

export function ChatPresetDialog({
  open,
  onOpenChange,
  showId,
  profileId,
  presets,
  onSend,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly showId: ShowId;
  readonly profileId: ProfileId;
  readonly presets: ReadonlyArray<ChatPreset>;
  readonly onSend: (
    body: string,
    parts: ReadonlyArray<ChatMessagePart>,
  ) => Promise<string | undefined>;
}) {
  const [mode, setMode] = React.useState<Mode>({ type: "list" });

  React.useEffect(() => {
    if (!open) setMode({ type: "list" });
  }, [open]);

  const back = () => setMode({ type: "list" });
  const title =
    mode.type === "list"
      ? "Message presets"
      : mode.type === "use"
        ? mode.preset.name
        : mode.type === "delete"
          ? "Delete preset?"
          : mode.preset
            ? "Edit preset"
            : "New preset";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {mode.type !== "list" && (
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label="Back to presets"
                onClick={back}
              >
                <ArrowLeftIcon />
              </Button>
            )}
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription>
            {mode.type === "list"
              ? "Choose a prepared message or create one for this show."
              : mode.type === "use"
                ? "Fill the few details below, then send."
                : mode.type === "delete"
                  ? `“${mode.preset.name}” will be permanently removed.`
                  : "Use {{name}} placeholders for the details that change each time."}
          </DialogDescription>
        </DialogHeader>

        {mode.type === "list" && (
          <PresetList
            presets={presets}
            onUse={(preset) => setMode({ type: "use", preset })}
            onEdit={(preset) => setMode({ type: "edit", preset })}
            onDelete={(preset) => setMode({ type: "delete", preset })}
            onCreate={() => setMode({ type: "edit" })}
          />
        )}
        {mode.type === "use" && (
          <UsePreset
            key={mode.preset.id}
            preset={mode.preset}
            showId={showId}
            onSend={async (body, parts) => {
              const error = await onSend(body, parts);
              if (!error) onOpenChange(false);
              return error;
            }}
          />
        )}
        {mode.type === "edit" && (
          <PresetEditor
            key={mode.preset?.id ?? "new"}
            showId={showId}
            profileId={profileId}
            preset={mode.preset}
            onSaved={(preset) => setMode({ type: "use", preset })}
          />
        )}
        {mode.type === "delete" && (
          <DeletePreset
            showId={showId}
            profileId={profileId}
            preset={mode.preset}
            onDeleted={back}
            onCancel={back}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PresetList({
  presets,
  onUse,
  onEdit,
  onDelete,
  onCreate,
}: {
  readonly presets: ReadonlyArray<ChatPreset>;
  readonly onUse: (preset: ChatPreset) => void;
  readonly onEdit: (preset: ChatPreset) => void;
  readonly onDelete: (preset: ChatPreset) => void;
  readonly onCreate: () => void;
}) {
  return (
    <>
      <ScrollArea className="max-h-[55dvh]">
        <div className="space-y-2 pr-2">
          {presets.length === 0 ? (
            <div className="grid min-h-40 place-content-center gap-2 text-center text-muted-foreground">
              <LibraryIcon className="mx-auto size-6" />
              <p className="text-sm">No presets yet</p>
              <p className="text-xs">Create one to send common messages in a few taps.</p>
            </div>
          ) : (
            presets.map((preset) => (
              <Item key={preset.id} variant="outline">
                <button
                  type="button"
                  className="min-w-0 flex-1 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  onClick={() => onUse(preset)}
                >
                  <ItemContent>
                    <ItemTitle>{preset.name}</ItemTitle>
                    <ItemDescription>{preset.template}</ItemDescription>
                  </ItemContent>
                </button>
                <ItemActions>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Actions for ${preset.name}`}
                        />
                      }
                    >
                      <EllipsisIcon />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" sideOffset={6}>
                      <DropdownMenuItem onClick={() => onEdit(preset)}>
                        <PencilIcon />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onClick={() => onDelete(preset)}>
                        <Trash2Icon />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </ItemActions>
              </Item>
            ))
          )}
        </div>
      </ScrollArea>
      <DialogFooter>
        <Button type="button" onClick={onCreate}>
          <FilePlus2Icon /> New preset
        </Button>
      </DialogFooter>
    </>
  );
}

function initialValues(
  preset: ChatPreset,
  microphones: ReadonlyArray<Microphone>,
  mixes: ReadonlyArray<Mix>,
) {
  return Object.fromEntries(
    preset.fields.map((field) => [
      field.name,
      field.type === "microphone"
        ? (microphones[0]?.id ?? "")
        : field.type === "mix"
          ? (mixes[0]?.id ?? "")
          : field.type === "select"
            ? (field.options[0] ?? "")
            : "",
    ]),
  );
}

function resolvePreset(
  preset: ChatPreset,
  values: Readonly<Record<string, string>>,
  microphones: ReadonlyArray<Microphone>,
  mixes: ReadonlyArray<Mix>,
) {
  const parts = new Map<string, ChatMessagePart>();
  for (const field of preset.fields) {
    const value = values[field.name]?.trim() ?? "";
    if (!value) return undefined;
    if (field.type === "microphone") {
      const mic = microphones.find((item) => item.id === value);
      if (!mic) return undefined;
      parts.set(field.name, {
        type: "microphone",
        id: mic.id,
        number: mic.number,
        color: mic.color,
        ...(mic.name ? { name: mic.name } : {}),
        text: `Mic ${mic.number}${mic.name ? ` (${mic.name})` : ""}`,
      });
    } else if (field.type === "mix") {
      const mix = mixes.find((item) => item.id === value);
      if (!mix) return undefined;
      parts.set(field.name, {
        type: "mix",
        id: mix.id,
        number: mix.number,
        color: mix.color,
        ...(mix.name ? { name: mix.name } : {}),
        text: `Mix ${mix.number}${mix.name ? ` (${mix.name})` : ""}`,
      });
    } else {
      parts.set(field.name, { type: "text", text: value });
    }
  }
  return resolveChatPresetTemplate(preset.template, parts);
}

function UsePreset({
  preset,
  showId,
  onSend,
}: {
  readonly preset: ChatPreset;
  readonly showId: ShowId;
  readonly onSend: (
    body: string,
    parts: ReadonlyArray<ChatMessagePart>,
  ) => Promise<string | undefined>;
}) {
  const microphonesResult = useAtomValue(microphoneAtoms(showId).microphones);
  const mixesResult = useAtomValue(mixAtoms(showId).mixes);
  const microphones = React.useMemo(
    () =>
      AsyncResult.isSuccess(microphonesResult)
        ? microphonesResult.value.filter((item) => !item.deletedAt)
        : [],
    [microphonesResult],
  );
  const mixes = React.useMemo(
    () =>
      AsyncResult.isSuccess(mixesResult) ? mixesResult.value.filter((item) => !item.deletedAt) : [],
    [mixesResult],
  );
  const [values, setValues] = React.useState<Record<string, string>>(() =>
    initialValues(preset, microphones, mixes),
  );
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string>();

  React.useEffect(() => {
    setValues((current) => {
      const defaults = initialValues(preset, microphones, mixes);
      return Object.fromEntries(
        Object.entries(defaults).map(([name, value]) => [name, current[name] || value]),
      );
    });
  }, [mixes, microphones, preset]);

  const resolved = resolvePreset(preset, values, microphones, mixes);
  const setValue = (name: string, value: string) =>
    setValues((current) => ({ ...current, [name]: value }));
  const send = async () => {
    if (!resolved || sending) return;
    setSending(true);
    setError(undefined);
    const nextError = await onSend(resolved.body, resolved.parts);
    if (nextError) setError(nextError);
    setSending(false);
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {preset.fields.map((field, index) => (
          <label key={field.name} className="grid gap-1.5 text-sm">
            <span className="font-medium">{readableFieldName(field.name)}</span>
            {field.type === "microphone" ? (
              <Select
                value={values[field.name] || null}
                onValueChange={(value) => value && setValue(field.name, value)}
              >
                <SelectTrigger autoFocus={index === 0} aria-label={readableFieldName(field.name)}>
                  <SelectValue>
                    <ChannelSelectValue
                      channel={microphones.find((mic) => mic.id === values[field.name])}
                      placeholder="Choose microphone"
                    />
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {microphones.map((mic) => (
                    <SelectItem key={mic.id} value={mic.id}>
                      <ChannelIdentity channel={mic} />
                      {mic.name ? ` — ${mic.name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : field.type === "mix" ? (
              <Select
                value={values[field.name] || null}
                onValueChange={(value) => value && setValue(field.name, value)}
              >
                <SelectTrigger autoFocus={index === 0} aria-label={readableFieldName(field.name)}>
                  <SelectValue>
                    <ChannelSelectValue
                      channel={mixes.find((mix) => mix.id === values[field.name])}
                      placeholder="Choose mix"
                    />
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {mixes.map((mix) => (
                    <SelectItem key={mix.id} value={mix.id}>
                      <ChannelIdentity channel={mix} />
                      {mix.name ? ` — ${mix.name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : field.type === "select" ? (
              <Select
                value={values[field.name] || null}
                onValueChange={(value) => value && setValue(field.name, value)}
              >
                <SelectTrigger autoFocus={index === 0} aria-label={readableFieldName(field.name)}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {field.options.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                autoFocus={index === 0}
                type={field.type === "number" ? "number" : "text"}
                inputMode={field.type === "number" ? "decimal" : undefined}
                value={values[field.name] ?? ""}
                placeholder={field.type === "number" ? "Enter number" : "Enter text"}
                onChange={(event) => setValue(field.name, event.currentTarget.value)}
              />
            )}
          </label>
        ))}
      </div>
      <div className="rounded-lg border bg-muted/40 p-3 text-sm whitespace-pre-wrap">
        {resolved ? (
          <ChatMessageBody body={resolved.body} parts={resolved.parts} />
        ) : (
          <span className="text-muted-foreground">Complete the fields to preview the message.</span>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button type="submit" disabled={!resolved || sending}>
          {sending ? <Spinner /> : <ArrowUpIcon />} Send message
        </Button>
      </DialogFooter>
    </form>
  );
}

interface FieldDraft {
  readonly name: string;
  readonly type: ChatPresetField["type"];
  readonly options: string;
}

const draftsForTemplate = (
  template: string,
  previous: ReadonlyArray<FieldDraft>,
): Array<FieldDraft> =>
  chatPresetPlaceholderNames(template).map(
    (name) => previous.find((field) => field.name === name) ?? { name, type: "text", options: "" },
  );

const presetFieldsFromDrafts = (
  drafts: ReadonlyArray<FieldDraft>,
): ReadonlyArray<ChatPresetField> =>
  drafts.map((field) =>
    field.type === "select"
      ? {
          name: field.name,
          type: "select",
          options: field.options
            .split(",")
            .map((option) => option.trim())
            .filter(Boolean),
        }
      : { name: field.name, type: field.type },
  );

function PresetEditor({
  showId,
  profileId,
  preset,
  onSaved,
}: {
  readonly showId: ShowId;
  readonly profileId: ProfileId;
  readonly preset?: ChatPreset;
  readonly onSaved: (preset: ChatPreset) => void;
}) {
  const atoms = chatAtoms(showId, profileId);
  const createPreset = useAtomSet(atoms.createPreset, { mode: "promiseExit" });
  const updatePreset = useAtomSet(atoms.updatePreset, { mode: "promiseExit" });
  const [name, setName] = React.useState(preset?.name ?? "");
  const [template, setTemplate] = React.useState(preset?.template ?? "");
  const [drafts, setDrafts] = React.useState<Array<FieldDraft>>(
    () =>
      preset?.fields.map((field) => ({
        name: field.name,
        type: field.type,
        options: field.type === "select" ? field.options.join(", ") : "",
      })) ?? [],
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string>();

  const changeTemplate = (value: string) => {
    setTemplate(value);
    setDrafts((current) => draftsForTemplate(value, current));
  };
  const fields = presetFieldsFromDrafts(drafts);
  const definitionError = template.trim()
    ? validateChatPresetDefinition({ template: template.trim(), fields })
    : undefined;
  const canSave = Boolean(name.trim() && template.trim() && !definitionError);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSave || saving) return;
    setSaving(true);
    setError(undefined);
    const common = {
      showId,
      name: name.trim() as ChatPresetName,
      template: template.trim() as ChatPresetTemplate,
      fields,
    };
    const exit = preset
      ? await updatePreset({
          payload: { ...common, presetId: preset.id },
          reactivityKeys: chatsSyncKey(showId),
        })
      : await createPreset({ payload: common, reactivityKeys: chatsSyncKey(showId) });
    if (Exit.isFailure(exit)) setError(rpcErrorMessageFromCause(exit.cause));
    else onSaved(exit.value);
    setSaving(false);
  };

  return (
    <form className="space-y-4" onSubmit={save}>
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Preset name</span>
        <Input
          autoFocus
          value={name}
          maxLength={80}
          placeholder="e.g. Monitor change"
          onChange={(event) => setName(event.currentTarget.value)}
        />
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Message</span>
        <Textarea
          value={template}
          maxLength={4_000}
          rows={3}
          placeholder="Put {{mic}} in {{mix}} at {{level}}"
          onChange={(event) => changeTemplate(event.currentTarget.value)}
        />
        <span className="text-xs text-muted-foreground">
          Wrap each changing detail in double braces.
        </span>
      </label>
      {drafts.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Details to fill</p>
          {drafts.map((field) => (
            <div
              key={field.name}
              className="grid gap-2 rounded-lg border p-2 sm:grid-cols-[1fr_10rem]"
            >
              <div className="min-w-0">
                <code className="text-sm">{`{{${field.name}}}`}</code>
                {field.type === "select" && (
                  <div className="mt-2">
                    <Input
                      value={field.options}
                      placeholder="Options, separated by commas"
                      aria-label={`Options for ${field.name}`}
                      onChange={(event) => {
                        const options = event.currentTarget.value;
                        setDrafts((current) =>
                          current.map((item) =>
                            item.name === field.name ? { ...item, options } : item,
                          ),
                        );
                      }}
                    />
                  </div>
                )}
              </div>
              <Select
                value={field.type}
                onValueChange={(value) =>
                  value &&
                  setDrafts((current) =>
                    current.map((item) =>
                      item.name === field.name
                        ? { ...item, type: value as ChatPresetField["type"] }
                        : item,
                    ),
                  )
                }
              >
                <SelectTrigger aria-label={`Type for ${field.name}`}>
                  <SelectValue>{fieldTypeLabels[field.type]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="microphone">
                    <span className="flex items-center gap-2">
                      <Mic2Icon className="size-4" /> Microphone
                    </span>
                  </SelectItem>
                  <SelectItem value="mix">
                    <span className="flex items-center gap-2">
                      <SpeakerIcon className="size-4" /> Mix
                    </span>
                  </SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="select">Options</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}
      {definitionError && template.trim() && (
        <p role="alert" className="text-xs text-destructive">
          {definitionError}
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button type="submit" disabled={!canSave || saving}>
          {saving ? <Spinner /> : null}
          {preset ? "Save changes" : "Create preset"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function DeletePreset({
  showId,
  profileId,
  preset,
  onDeleted,
  onCancel,
}: {
  readonly showId: ShowId;
  readonly profileId: ProfileId;
  readonly preset: ChatPreset;
  readonly onDeleted: () => void;
  readonly onCancel: () => void;
}) {
  const remove = useAtomSet(chatAtoms(showId, profileId).deletePreset, { mode: "promiseExit" });
  const [deleting, setDeleting] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const confirm = async () => {
    setDeleting(true);
    setError(undefined);
    const exit = await remove({
      payload: { showId, presetId: preset.id },
      reactivityKeys: chatsSyncKey(showId),
    });
    if (Exit.isFailure(exit)) setError(rpcErrorMessageFromCause(exit.cause));
    else onDeleted();
    setDeleting(false);
  };
  return (
    <>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" disabled={deleting} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" variant="destructive" disabled={deleting} onClick={confirm}>
          <Trash2Icon /> {deleting ? "Deleting..." : "Delete"}
        </Button>
      </DialogFooter>
    </>
  );
}
