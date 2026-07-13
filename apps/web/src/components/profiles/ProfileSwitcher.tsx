import * as React from "react";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Exit, Option } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import {
  profilesSyncKey,
  type Color,
  type Profile,
  type ProfileName,
  type ProfilesState,
} from "@showtime/contracts";
import { PencilIcon, PlusIcon, StarIcon, Trash2Icon } from "lucide-react";
import { profileAtoms, rpcErrorMessageFromCause } from "@/client";
import { useSelectedProfile } from "@/profiles";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Item, ItemActions, ItemContent, ItemGroup } from "@/components/ui/item";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { showColorClassNames } from "@/components/shows/show-color";
import { cn } from "@/lib/utils";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { ColorPickerPopover } from "@/components/ColorPickerPopover";

const mutationOptions = { reactivityKeys: profilesSyncKey } as const;

const currentState = (
  result: AsyncResult.AsyncResult<ProfilesState, unknown>,
): ProfilesState | undefined =>
  AsyncResult.isSuccess(result)
    ? result.value
    : AsyncResult.isFailure(result)
      ? Option.getOrUndefined(result.previousSuccess)?.value
      : undefined;

export function ProfileSwitcher({ className }: { readonly className?: string }) {
  const result = useAtomValue(profileAtoms.state);
  const state = currentState(result);
  const { selected, select } = useSelectedProfile(state);
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <ButtonGroup aria-label="Profile controls" className={className}>
        <Select
          value={selected?.id ?? ""}
          disabled={!state}
          onValueChange={(id) => {
            const profile = state?.profiles.find((item) => item.id === id);
            if (profile) select(profile);
          }}
        >
          <SelectTrigger aria-label="Selected profile" className="w-44">
            <SelectValue>
              {selected ? <ProfileLabel profile={selected} /> : "Loading profiles…"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {state?.profiles.map((profile) => (
              <SelectItem key={profile.id} value={profile.id}>
                <ProfileLabel profile={profile} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label="Manage profiles"
          onClick={() => setOpen(true)}
        >
          <PencilIcon />
        </Button>
      </ButtonGroup>
      <ProfileDialog open={open} onOpenChange={setOpen} state={state} loadResult={result} />
    </>
  );
}

function ProfileLabel({ profile }: { readonly profile: Profile }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className={cn(showColorClassNames[profile.color], "size-3 shrink-0 rounded-full")} />
      <span className="truncate">{profile.name}</span>
    </span>
  );
}

function ProfileDialog({
  open,
  onOpenChange,
  state,
  loadResult,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly state: ProfilesState | undefined;
  readonly loadResult: AsyncResult.AsyncResult<ProfilesState, unknown>;
}) {
  const create = useAtomSet(profileAtoms.create, { mode: "promiseExit" });
  const [error, setError] = React.useState<string>();
  const [adding, setAdding] = React.useState(false);

  const add = async () => {
    if (!state || adding) return;
    setAdding(true);
    setError(undefined);
    const result = await create({
      payload: { name: `Profile ${state.profiles.length + 1}` as ProfileName, color: "sky" },
      ...mutationOptions,
    });
    if (Exit.isFailure(result)) setError(rpcErrorMessageFromCause(result.cause));
    setAdding(false);
  };

  const loadError =
    AsyncResult.isFailure(loadResult) && !state
      ? rpcErrorMessageFromCause(loadResult.cause)
      : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Profiles</DialogTitle>
          <DialogDescription>
            Choose names and colors, and set the profile used by default.
          </DialogDescription>
        </DialogHeader>
        <ItemGroup>
          {state?.profiles.map((profile) => (
            <ProfileRow
              key={profile.id}
              profile={profile}
              isDefault={profile.id === state.defaultProfileId}
              onError={setError}
            />
          ))}
        </ItemGroup>
        <Button type="button" variant="outline" disabled={!state || adding} onClick={add}>
          <PlusIcon /> {adding ? "Adding…" : "Add profile"}
        </Button>
        {(error ?? loadError) && (
          <p role="alert" className="text-sm text-destructive">
            {error ?? loadError}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ProfileRow({
  profile,
  isDefault,
  onError,
}: {
  readonly profile: Profile;
  readonly isDefault: boolean;
  readonly onError: (message: string | undefined) => void;
}) {
  const edit = useAtomSet(profileAtoms.edit, { mode: "promiseExit" });
  const remove = useAtomSet(profileAtoms.delete, { mode: "promiseExit" });
  const setDefault = useAtomSet(profileAtoms.setDefault, { mode: "promiseExit" });
  const [name, setName] = React.useState(profile.name as string);
  const [color, setColor] = React.useState<Color>(profile.color);
  const [busy, setBusy] = React.useState(false);
  const saveQueue = React.useRef(Promise.resolve());
  React.useEffect(() => {
    setName(profile.name);
    setColor(profile.color);
  }, [profile.color, profile.name]);

  const run = (operation: () => Promise<Exit.Exit<unknown, unknown>>) => {
    setBusy(true);
    onError(undefined);
    saveQueue.current = saveQueue.current
      .then(async () => {
        const result = await operation();
        if (Exit.isFailure(result)) onError(rpcErrorMessageFromCause(result.cause));
      })
      .finally(() => setBusy(false));
  };

  const save = (nextName: string, nextColor: Color) => {
    const trimmedName = nextName.trim();
    if (!trimmedName) {
      setName(profile.name);
      return;
    }
    if (trimmedName === profile.name && nextColor === profile.color) return;
    onError(undefined);
    saveQueue.current = saveQueue.current.then(async () => {
      const result = await edit({
        payload: {
          id: profile.id,
          name: trimmedName as ProfileName,
          color: nextColor,
        },
        ...mutationOptions,
      });
      if (Exit.isFailure(result)) onError(rpcErrorMessageFromCause(result.cause));
    });
  };

  return (
    <Item variant="outline" className="flex-nowrap">
      <ItemContent className="min-w-0">
        <InputGroup>
          <InputGroupInput
            aria-label={`Name for ${profile.name}`}
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.currentTarget.value)}
            onBlur={() => save(name, color)}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") {
                setName(profile.name);
                event.currentTarget.blur();
              }
            }}
          />
          <InputGroupAddon>
            <ColorPickerPopover
              color={color}
              onColorChange={(nextColor) => {
                setColor(nextColor);
                save(name, nextColor);
              }}
              trigger={
                <InputGroupButton size="icon-xs" aria-label={`Choose color for ${profile.name}`} />
              }
            >
              <span className={cn(showColorClassNames[color], "size-3 rounded-full")} />
            </ColorPickerPopover>
          </InputGroupAddon>
        </InputGroup>
      </ItemContent>
      <ItemActions>
        <Button
          type="button"
          size="icon-sm"
          variant={isDefault ? "secondary" : "ghost"}
          aria-label={isDefault ? `${profile.name} is default` : `Set ${profile.name} as default`}
          disabled={busy || isDefault}
          onClick={() => run(() => setDefault({ payload: { id: profile.id }, ...mutationOptions }))}
        >
          <StarIcon className={isDefault ? "fill-current" : undefined} />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={`Delete ${profile.name}`}
          disabled={busy || isDefault}
          onClick={() => run(() => remove({ payload: { id: profile.id }, ...mutationOptions }))}
        >
          <Trash2Icon />
        </Button>
      </ItemActions>
    </Item>
  );
}
