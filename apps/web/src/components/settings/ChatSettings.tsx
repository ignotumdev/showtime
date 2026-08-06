import * as React from "react";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Exit, Option } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import {
  chatsSyncKey,
  type ChatChannel,
  type ChatChannelId,
  type ChatChannelName,
  type ChatSnapshot,
  type Profile,
  type ProfileId,
  type ShowId,
} from "@showtime/contracts";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { chatAtoms, profileAtoms, rpcErrorMessageFromCause } from "@/client";
import { ProfileAvatar } from "@/components/profiles/ProfileAvatar";
import { currentProfilesState } from "@/components/profiles/ProfileSwitcher";
import { SettingsHeader, SettingsItem, SettingsSection } from "@/components/settings/SettingsPage";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Switch } from "@/components/ui/switch";
import { useShowFromParams } from "@/hooks/useShowFromParams";

const currentChatSnapshot = (
  result: AsyncResult.AsyncResult<ChatSnapshot, unknown>,
): ChatSnapshot | undefined =>
  AsyncResult.isSuccess(result)
    ? result.value
    : AsyncResult.isFailure(result)
      ? Option.getOrUndefined(result.previousSuccess)?.value
      : undefined;

export function ChatSettings() {
  const { showId } = useShowFromParams();
  const profilesResult = useAtomValue(profileAtoms.state);
  const profilesState = currentProfilesState(profilesResult);

  return (
    <div className="space-y-6">
      <SettingsHeader>Chat</SettingsHeader>
      {showId && profilesState && profilesState.profiles.length > 0 ? (
        <ChatSettingsLoaded showId={showId as ShowId} profiles={profilesState.profiles} />
      ) : (
        <SettingsSection title="Channels">
          <SettingsItem title="Loading chat settings…" />
        </SettingsSection>
      )}
    </div>
  );
}

function ChatSettingsLoaded({
  showId,
  profiles,
}: {
  readonly showId: ShowId;
  readonly profiles: ReadonlyArray<Profile>;
}) {
  const ownerProfile = profiles[0]!;
  const atoms = chatAtoms(showId, ownerProfile.id);
  const result = useAtomValue(atoms.state);
  const snapshot = currentChatSnapshot(result);
  const createChannel = useAtomSet(atoms.createChannel, { mode: "promiseExit" });
  const deleteChannel = useAtomSet(atoms.deleteChannel, { mode: "promiseExit" });
  const [newName, setNewName] = React.useState("");
  const [deleteTarget, setDeleteTarget] = React.useState<ChatChannel>();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const mutationOptions = { reactivityKeys: chatsSyncKey(showId) } as const;
  const channels = snapshot?.channels ?? [];

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    setError(undefined);
    const exit = await createChannel({
      payload: { showId, name: name as ChatChannelName },
      ...mutationOptions,
    });
    if (Exit.isFailure(exit)) setError(rpcErrorMessageFromCause(exit.cause));
    else setNewName("");
    setBusy(false);
  };

  const remove = async () => {
    if (!deleteTarget || busy) return;
    setBusy(true);
    setError(undefined);
    const exit = await deleteChannel({
      payload: { showId, channelId: deleteTarget.id },
      ...mutationOptions,
    });
    if (Exit.isFailure(exit)) setError(rpcErrorMessageFromCause(exit.cause));
    else setDeleteTarget(undefined);
    setBusy(false);
  };

  return (
    <>
      <SettingsSection title="Channels">
        {channels.map((channel) => (
          <SettingsItem
            key={channel.id}
            title={
              <ChannelNameInput
                showId={showId}
                ownerProfileId={ownerProfile.id}
                channel={channel}
                onError={setError}
              />
            }
            description={`${channel.messageCount} message${channel.messageCount === 1 ? "" : "s"}`}
            action={
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={`Delete ${channel.name}`}
                disabled={channels.length === 1}
                onClick={() => setDeleteTarget(channel)}
              >
                <Trash2Icon />
              </Button>
            }
          />
        ))}
        <form className="flex max-w-xl flex-col gap-2 pt-4 sm:flex-row" onSubmit={add}>
          <InputGroup variant="ghost">
            <InputGroupAddon>
              <InputGroupText>#</InputGroupText>
            </InputGroupAddon>
            <InputGroupInput
              aria-label="New channel name"
              value={newName}
              maxLength={60}
              placeholder="New channel"
              onChange={(event) => setNewName(event.currentTarget.value)}
            />
          </InputGroup>
          <Button type="submit" variant="outline" disabled={!newName.trim() || busy}>
            <PlusIcon /> Add channel
          </Button>
        </form>
        {error && (
          <p role="alert" className="pt-3 text-sm text-destructive">
            {error}
          </p>
        )}
      </SettingsSection>

      <SettingsSection title="Notifications">
        <p className="pb-2 text-sm text-muted-foreground">
          Choose which channel notifications each profile receives.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-lg border-collapse text-sm">
            <thead>
              <tr className="border-b text-left">
                <th scope="col" className="h-10 pr-4 font-medium text-muted-foreground">
                  Profile
                </th>
                {channels.map((channel) => (
                  <th
                    key={channel.id}
                    scope="col"
                    className="h-10 px-3 text-center font-medium whitespace-nowrap text-muted-foreground"
                  >
                    # {channel.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {profiles.map((profile) => (
                <tr key={profile.id}>
                  <th scope="row" className="h-14 pr-4 text-left font-medium whitespace-nowrap">
                    <span className="flex items-center gap-2">
                      <ProfileAvatar
                        name={profile.name}
                        color={profile.color}
                        className="size-6 text-[10px]"
                      />
                      {profile.name}
                    </span>
                  </th>
                  {channels.map((channel) => (
                    <td key={channel.id} className="h-14 px-3 text-center">
                      <ChannelNotificationSwitch
                        showId={showId}
                        profile={profile}
                        channelId={channel.id}
                        channelName={channel.name}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SettingsSection>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete channel?</DialogTitle>
            <DialogDescription>
              All messages in #{deleteTarget?.name} will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button variant="destructive" disabled={busy} onClick={remove}>
              <Trash2Icon /> Delete channel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ChannelNameInput({
  showId,
  ownerProfileId,
  channel,
  onError,
}: {
  readonly showId: ShowId;
  readonly ownerProfileId: ProfileId;
  readonly channel: ChatChannel;
  readonly onError: (message: string | undefined) => void;
}) {
  const renameChannel = useAtomSet(chatAtoms(showId, ownerProfileId).renameChannel, {
    mode: "promiseExit",
  });
  const [name, setName] = React.useState(channel.name as string);
  const [saving, setSaving] = React.useState(false);
  const cancelSave = React.useRef(false);

  React.useEffect(() => setName(channel.name), [channel.name]);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setName(channel.name);
      return;
    }
    if (trimmed === channel.name) return;
    setSaving(true);
    onError(undefined);
    const exit = await renameChannel({
      payload: { showId, channelId: channel.id, name: trimmed as ChatChannelName },
      reactivityKeys: chatsSyncKey(showId),
    });
    if (Exit.isFailure(exit)) {
      setName(channel.name);
      onError(rpcErrorMessageFromCause(exit.cause));
    }
    setSaving(false);
  };

  return (
    <InputGroup variant="ghost" className="max-w-sm">
      <InputGroupAddon>
        <InputGroupText>#</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput
        aria-label={`Name for ${channel.name}`}
        value={name}
        maxLength={60}
        disabled={saving}
        onFocus={() => {
          cancelSave.current = false;
        }}
        onChange={(event) => setName(event.currentTarget.value)}
        onBlur={() => {
          if (cancelSave.current) {
            cancelSave.current = false;
            return;
          }
          void save();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            cancelSave.current = true;
            setName(channel.name);
            event.currentTarget.blur();
          }
        }}
      />
    </InputGroup>
  );
}

function ChannelNotificationSwitch({
  showId,
  profile,
  channelId,
  channelName,
}: {
  readonly showId: ShowId;
  readonly profile: Profile;
  readonly channelId: ChatChannelId;
  readonly channelName: string;
}) {
  const atoms = chatAtoms(showId, profile.id);
  const result = useAtomValue(atoms.state);
  const setNotifications = useAtomSet(atoms.setNotifications, { mode: "promiseExit" });
  const channel = currentChatSnapshot(result)?.channels.find((item) => item.id === channelId);
  const [saving, setSaving] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  const toggle = async (enabled: boolean) => {
    setSaving(true);
    setFailed(false);
    const exit = await setNotifications({
      payload: { showId, channelId, profileId: profile.id, enabled },
      reactivityKeys: chatsSyncKey(showId),
    });
    if (Exit.isFailure(exit)) setFailed(true);
    setSaving(false);
  };

  return (
    <>
      <Switch
        aria-label={`${channelName} notifications for ${profile.name}`}
        checked={channel?.notificationsEnabled ?? false}
        disabled={!channel || saving}
        onCheckedChange={toggle}
      />
      {failed && (
        <span role="alert" className="sr-only">
          Could not update {channelName} notifications for {profile.name}.
        </span>
      )}
    </>
  );
}
