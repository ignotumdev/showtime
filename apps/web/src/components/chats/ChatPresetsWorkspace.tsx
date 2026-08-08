import * as React from "react";
import { useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/unstable/reactivity";
import type { ChatChannelId, ChatPreset, Profile, ShowId } from "@showtime/contracts";
import {
  EllipsisIcon,
  FilePlus2Icon,
  HashIcon,
  LibraryIcon,
  MessageCircleReplyIcon,
  PencilIcon,
  PlayIcon,
  Trash2Icon,
} from "lucide-react";
import { chatAtoms, profileAtoms } from "@/client";
import { ChatPresetDialog, type ChatPresetDialogMode } from "@/components/chats/ChatPresetDialog";
import { useSendChatMessage } from "@/components/chats/useSendChatMessage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useSelectedProfile } from "@/profiles";

type OpenDialog = {
  readonly key: string;
  readonly mode: ChatPresetDialogMode;
};

export function ChatPresetsWorkspace({ showId }: { readonly showId: ShowId }) {
  const profilesResult = useAtomValue(profileAtoms.state);
  const profileState = AsyncResult.isSuccess(profilesResult) ? profilesResult.value : undefined;
  const { selected } = useSelectedProfile(profileState);

  if (!selected) {
    return (
      <div className="grid h-full min-h-72 place-content-center">
        <Spinner />
      </div>
    );
  }

  return <ProfileChatPresetsWorkspace key={selected.id} showId={showId} profile={selected} />;
}

function ProfileChatPresetsWorkspace({
  showId,
  profile,
}: {
  readonly showId: ShowId;
  readonly profile: Profile;
}) {
  const result = useAtomValue(chatAtoms(showId, profile.id).state);
  const snapshot = AsyncResult.isSuccess(result) ? result.value : undefined;
  const [channelId, setChannelId] = React.useState<ChatChannelId>();
  const channel = snapshot?.channels.find((item) => item.id === channelId) ?? snapshot?.channels[0];

  React.useEffect(() => {
    if (channel && channel.id !== channelId) setChannelId(channel.id);
  }, [channel, channelId]);

  if (!snapshot || !channel) {
    return (
      <Empty className="h-full">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            {AsyncResult.isFailure(result) ? <LibraryIcon /> : <Spinner />}
          </EmptyMedia>
          <EmptyTitle>
            {AsyncResult.isFailure(result) ? "Presets could not be loaded" : "Loading presets"}
          </EmptyTitle>
          {AsyncResult.isFailure(result) && (
            <EmptyDescription>Check the connection and try again.</EmptyDescription>
          )}
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ReadyChatPresetsWorkspace
      key={channel.id}
      showId={showId}
      profile={profile}
      channelId={channel.id}
      channels={snapshot.channels}
      presets={snapshot.presets}
      onChannelChange={setChannelId}
    />
  );
}

function ReadyChatPresetsWorkspace({
  showId,
  profile,
  channelId,
  channels,
  presets,
  onChannelChange,
}: {
  readonly showId: ShowId;
  readonly profile: Profile;
  readonly channelId: ChatChannelId;
  readonly channels: ReadonlyArray<{ readonly id: ChatChannelId; readonly name: string }>;
  readonly presets: ReadonlyArray<ChatPreset>;
  readonly onChannelChange: (channelId: ChatChannelId) => void;
}) {
  const [dialog, setDialog] = React.useState<OpenDialog>();
  const { sendMessage } = useSendChatMessage(showId, profile.id, channelId);
  const open = (mode: ChatPresetDialogMode) =>
    setDialog({
      key: `${mode.type}:${"preset" in mode && mode.preset ? mode.preset.id : "new"}`,
      mode,
    });

  return (
    <section className="mx-auto flex h-full w-full max-w-6xl flex-col gap-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <LibraryIcon className="size-5" />
            <h1 className="text-xl font-semibold tracking-tight">Message presets</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Prepare common messages once, then send them with the right details in a few taps.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid min-w-48 flex-1 gap-1 text-xs text-muted-foreground sm:flex-none">
            Send to
            <Select value={channelId} onValueChange={(value) => value && onChannelChange(value)}>
              <SelectTrigger aria-label="Preset destination channel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {channels.map((channel) => (
                  <SelectItem key={channel.id} value={channel.id}>
                    <span className="flex items-center gap-2">
                      <HashIcon className="size-4" /> {channel.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <Button type="button" onClick={() => open({ type: "edit" })}>
            <FilePlus2Icon /> New preset
          </Button>
        </div>
      </header>

      {presets.length === 0 ? (
        <Empty className="min-h-72 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LibraryIcon />
            </EmptyMedia>
            <EmptyTitle>No presets yet</EmptyTitle>
            <EmptyDescription>
              Create a reusable message for checks, routing changes, or anything your team sends
              often.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button type="button" onClick={() => open({ type: "edit" })}>
              <FilePlus2Icon /> Create first preset
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-[repeat(auto-fill,minmax(18rem,1fr))]">
          {presets.map((preset) => (
            <PresetCard
              key={preset.id}
              preset={preset}
              onUse={() => open({ type: "use", preset })}
              onEdit={() => open({ type: "edit", preset })}
              onDelete={() => open({ type: "delete", preset })}
            />
          ))}
        </div>
      )}

      {dialog && (
        <ChatPresetDialog
          key={dialog.key}
          open
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setDialog(undefined);
          }}
          showId={showId}
          profileId={profile.id}
          presets={presets}
          initialMode={dialog.mode}
          onSend={(body, parts, answer) =>
            sendMessage(body, parts, answer ? { answer } : undefined)
          }
        />
      )}
    </section>
  );
}

function PresetCard({
  preset,
  onUse,
  onEdit,
  onDelete,
}: {
  readonly preset: ChatPreset;
  readonly onUse: () => void;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{preset.name}</CardTitle>
        <CardDescription className="line-clamp-3 whitespace-pre-wrap">
          {preset.template}
        </CardDescription>
        <CardAction>
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
              <DropdownMenuItem onClick={onEdit}>
                <PencilIcon /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2Icon /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>
      <CardContent className="flex min-h-8 flex-wrap gap-1.5">
        {preset.fields.map((field) => (
          <Badge key={field.name} variant="outline">
            {field.name}
          </Badge>
        ))}
        {preset.answer && (
          <Badge variant="secondary">
            <MessageCircleReplyIcon /> Reply requested
          </Badge>
        )}
        {preset.fields.length === 0 && !preset.answer && (
          <span className="text-xs text-muted-foreground">Ready to send as-is</span>
        )}
      </CardContent>
      <CardFooter>
        <Button type="button" className="w-full" onClick={onUse}>
          <PlayIcon /> Use preset
        </Button>
      </CardFooter>
    </Card>
  );
}
