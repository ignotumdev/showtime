import * as React from "react";
import { useAtomValue } from "@effect/atom-react";
import QRCode from "qrcode";
import { CheckIcon, CopyIcon, PlusIcon, Trash2Icon, WifiIcon, WifiOffIcon } from "lucide-react";
import type {
  ShowtimeConnectionCandidate,
  ShowtimeConnectionsState,
  ShowtimeLocalDiscoveryState,
  ShowtimePendingClient,
} from "@showtime/shared";
import type { Profile } from "@showtime/contracts";
import {
  hasShowtimeConnectionManagementScopes,
  normalizeShowtimeHostName,
  showtimeHostNameMaxLength,
  showtimeConnectionManagementScopes,
} from "@showtime/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  canLoadPairingInfo,
  pairingInfoPollDelay,
  pairingInfoRetryDelay,
  pairingInfoRetryWait,
  selectPairingCandidateUrl,
  shouldPollPairingInfo,
} from "./pairing-dialog";
import {
  getConnectionManagementClient,
  type ConnectionManagementClient,
} from "./connection-management";
import { cn } from "@/lib/utils";
import { copyText } from "@/clipboard";
import { profileAtoms } from "@/client";
import { useProfileSelection } from "@/profiles";
import { currentProfilesState, ProfileControl } from "@/components/profiles/ProfileSwitcher";
import { showColorClassNames } from "@/components/shows/show-color";
import { useIsMobileDrawer } from "@/hooks/use-mobile-drawer";

const emptyState: ShowtimeConnectionsState = {
  enabled: false,
  hostName: "device",
  hostname: "showtime-device.local",
  clients: [],
};

const timeUntil = (expiresAt: string, now: number) => {
  const remaining = Math.max(0, Date.parse(expiresAt) - now);
  if (remaining === 0) return "Link expired";
  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1_000);
  return `Link expires in ${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export function ConnectionDialog({
  className,
  compact = false,
}: {
  readonly className?: string;
  readonly compact?: boolean;
}) {
  const [manager] = React.useState(getConnectionManagementClient);
  const isMobile = useIsMobileDrawer();
  const profilesResult = useAtomValue(profileAtoms.state);
  const profilesState = currentProfilesState(profilesResult);
  const [open, setOpen] = React.useState(false);
  const [state, setState] = React.useState(emptyState);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [hostNameOpen, setHostNameOpen] = React.useState(false);
  const [pairingClient, setPairingClient] = React.useState<ShowtimePendingClient>();
  const [loadError, setLoadError] = React.useState<string>();
  const [error, setError] = React.useState<string>();
  const [loading, setLoading] = React.useState(false);
  const [now, setNow] = React.useState(Date.now());
  const refreshGeneration = React.useRef(0);
  const refreshInFlight = React.useRef(false);

  const refresh = React.useCallback(async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    const generation = refreshGeneration.current;
    try {
      if (!manager) return;
      const value = await manager.connectionsState();
      if (generation !== refreshGeneration.current) return;
      setState(value);
      setLoadError(undefined);
    } catch {
      if (generation === refreshGeneration.current)
        setLoadError("Showtime could not load connections.");
    } finally {
      refreshInFlight.current = false;
    }
  }, [manager]);

  React.useEffect(() => {
    if (!open) return;
    let active = true;
    const update = () => void refresh();
    update();
    const poll = window.setInterval(update, 1_000);
    const clock = window.setInterval(() => active && setNow(Date.now()), 1_000);
    return () => {
      active = false;
      refreshGeneration.current += 1;
      window.clearInterval(poll);
      window.clearInterval(clock);
    };
  }, [open, refresh]);

  const updateEnabled = async (enabled: boolean) => {
    setLoading(true);
    setError(undefined);
    try {
      if (!manager?.setConnectionsEnabled) return;
      setState(await manager.setConnectionsEnabled(enabled));
    } catch {
      setError("Showtime could not update connection settings.");
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id: string) => {
    setLoading(true);
    setError(undefined);
    try {
      if (!manager) return;
      setState(await manager.removeConnection(id));
      if (pairingClient?.invitationId === id) setPairingClient(undefined);
    } catch {
      setError("Showtime could not remove this client.");
    } finally {
      setLoading(false);
    }
  };

  if (!manager) return null;

  return (
    <>
      <Drawer open={open} onOpenChange={setOpen} swipeDirection={isMobile ? "down" : "right"}>
        <DrawerTrigger
          render={
            <Button
              size={compact ? "icon-sm" : "sm"}
              variant="ghost"
              className={cn(className)}
              aria-label="Connections"
            />
          }
        >
          <WifiIcon /> {!compact && "Connections"}
        </DrawerTrigger>
        <DrawerContent
          className={
            isMobile
              ? "[--drawer-height:calc(var(--app-height)-3rem)]"
              : "data-[swipe-axis=x]:[--drawer-content-width:min(32rem,100vw)]"
          }
        >
          <DrawerHeader>
            <DrawerTitle>Connections</DrawerTitle>
            <DrawerDescription>
              Manage access to Showtime from devices on this network.
            </DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            {manager.isOwner && (
              <>
                <Item variant="outline" render={<label htmlFor="showtime-connections-enabled" />}>
                  <ItemContent>
                    <ItemTitle>Allow connections</ItemTitle>
                    <ItemDescription>
                      Host the web app and let approved devices connect.
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Switch
                      id="showtime-connections-enabled"
                      checked={state.enabled}
                      disabled={loading}
                      onCheckedChange={updateEnabled}
                    />
                  </ItemActions>
                </Item>
                <Item variant="outline">
                  <ItemContent>
                    <ItemTitle>Host name</ItemTitle>
                    <ItemDescription>{state.hostname}</ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={loading || !state.enabled}
                      onClick={() => setHostNameOpen(true)}
                    >
                      Change
                    </Button>
                  </ItemActions>
                </Item>
              </>
            )}
            {state.clients.length > 0 && (
              <ItemGroup>
                {state.clients.map((client) => {
                  const id = client.kind === "pending" ? client.invitationId : client.clientId;
                  const connected = client.kind === "paired" && client.connected;
                  return (
                    <Item key={id} variant="outline">
                      <ItemMedia>
                        <span
                          className={`size-2.5 rounded-full ${connected ? "bg-primary" : "bg-destructive"}`}
                          aria-label={connected ? "Connected" : "Not connected"}
                        />
                      </ItemMedia>
                      <ItemContent>
                        <ItemTitle className="flex items-center gap-2">
                          <span className="truncate">{client.name}</span>
                          <ClientProfileBadge
                            profile={profilesState?.profiles.find(
                              (profile) => profile.id === client.clientProfile,
                            )}
                          />
                        </ItemTitle>
                        <ItemDescription>
                          {client.kind === "pending"
                            ? timeUntil(client.expiresAt, now)
                            : connected
                              ? "Connected now"
                              : "Not currently connected"}
                          {hasShowtimeConnectionManagementScopes(client.scopes)
                            ? " · Can manage connections"
                            : ""}
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        {client.kind === "pending" && (
                          <Button
                            type="button"
                            variant="outline"
                            disabled={loading || !state.enabled}
                            onClick={() => setPairingClient(client)}
                          >
                            Connect
                          </Button>
                        )}
                        {manager.canDelete && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            disabled={loading}
                            aria-label={`Remove ${client.name}`}
                            onClick={() => remove(id)}
                          >
                            <Trash2Icon />
                          </Button>
                        )}
                      </ItemActions>
                    </Item>
                  );
                })}
              </ItemGroup>
            )}
            {state.clients.length > 0 && state.enabled && manager.canCreate && (
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => setCreateOpen(true)}
              >
                <PlusIcon /> Add a new client
              </Button>
            )}
            {!loading && state.clients.length === 0 && (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <WifiOffIcon />
                  </EmptyMedia>
                  <EmptyTitle>No connected clients</EmptyTitle>
                  <EmptyDescription>
                    Add a client to give another device access to Showtime.
                  </EmptyDescription>
                </EmptyHeader>
                {state.enabled && manager.canCreate && (
                  <EmptyContent>
                    <Button type="button" variant="outline" onClick={() => setCreateOpen(true)}>
                      <PlusIcon /> Add a new client
                    </Button>
                  </EmptyContent>
                )}
              </Empty>
            )}
            {(error ?? loadError) && (
              <p role="alert" className="text-sm text-destructive">
                {error ?? loadError}
              </p>
            )}
          </div>
        </DrawerContent>
      </Drawer>
      <CreateClientDialog
        manager={manager}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={setState}
        profilesState={profilesState}
        profilesResult={profilesResult}
      />
      <HostNameDialog
        manager={manager}
        open={hostNameOpen}
        currentState={state}
        onOpenChange={setHostNameOpen}
        onChanged={(next) => {
          setState(next);
          setPairingClient(undefined);
        }}
      />
      <PairClientDialog
        manager={manager}
        key={pairingClient?.invitationId ?? "closed"}
        client={pairingClient}
        onOpenChange={(next) => !next && setPairingClient(undefined)}
      />
    </>
  );
}

function HostNameDialog({
  manager,
  open,
  currentState,
  onOpenChange,
  onChanged,
}: {
  readonly manager: ConnectionManagementClient;
  readonly open: boolean;
  readonly currentState: ShowtimeConnectionsState;
  readonly onOpenChange: (open: boolean) => void;
  readonly onChanged: (state: ShowtimeConnectionsState) => void;
}) {
  const [draft, setDraft] = React.useState(currentState.hostName);
  const [confirming, setConfirming] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string>();

  React.useEffect(() => {
    if (!open) return;
    setDraft(currentState.hostName);
    setConfirming(false);
    setSaving(false);
    setError(undefined);
  }, [open, currentState.hostName]);

  const candidate = draft.trim() ? normalizeShowtimeHostName(draft) : undefined;
  const hostname = candidate ? `showtime-${candidate}.local` : undefined;
  const changed = candidate !== undefined && candidate !== currentState.hostName;

  const save = async () => {
    if (!candidate || !manager.setHostName) return;
    setSaving(true);
    setError(undefined);
    try {
      onChanged(await manager.setHostName(candidate));
      onOpenChange(false);
    } catch {
      setError("Showtime could not change the host name.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{confirming ? "Change the host name?" : "Host name"}</DialogTitle>
          <DialogDescription>
            {confirming
              ? "The old address will stop working. Every paired client and pending connection will be removed."
              : "Choose the permanent local address people use to open this Showtime host."}
          </DialogDescription>
        </DialogHeader>
        {!confirming ? (
          <>
            <Input
              autoFocus
              value={draft}
              maxLength={showtimeHostNameMaxLength}
              placeholder="For example, front-of-house"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && changed && setConfirming(true)}
            />
            <p className="text-sm text-muted-foreground">
              New address: {hostname ?? "Enter a host name"}
            </p>
            <Button type="button" disabled={!changed} onClick={() => setConfirming(true)}>
              Continue
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm">
              Change <strong>{currentState.hostname}</strong> to <strong>{hostname}</strong> and
              remove {currentState.clients.length} connection
              {currentState.clients.length === 1 ? "" : "s"}?
            </p>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => setConfirming(false)}
              >
                Back
              </Button>
              <Button type="button" variant="destructive" disabled={saving} onClick={save}>
                {saving ? "Changing…" : "Change and remove connections"}
              </Button>
            </div>
          </>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ClientProfileBadge({ profile }: { readonly profile: Profile | undefined }) {
  return (
    <Badge variant="outline">
      <span
        className={cn(
          profile ? showColorClassNames[profile.color] : "bg-muted-foreground",
          "size-2 rounded-full",
        )}
      />
      {profile?.name ?? "Unknown profile"}
    </Badge>
  );
}

function CreateClientDialog({
  manager,
  open,
  onOpenChange,
  onCreated,
  profilesState,
  profilesResult,
}: {
  readonly manager: ConnectionManagementClient;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onCreated: (state: ShowtimeConnectionsState) => void;
  readonly profilesState: ReturnType<typeof currentProfilesState>;
  readonly profilesResult: Parameters<typeof currentProfilesState>[0];
}) {
  const { selected: currentProfile } = useProfileSelection(profilesState);
  const [name, setName] = React.useState("");
  const [clientProfileId, setClientProfileId] = React.useState("");
  const [canManageConnections, setCanManageConnections] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const creatingRef = React.useRef(false);
  const profileInitializedForOpen = React.useRef(false);
  const [error, setError] = React.useState<string>();
  const selectedProfile =
    profilesState?.profiles.find((profile) => profile.id === clientProfileId) ?? currentProfile;
  React.useEffect(() => {
    if (!open) {
      profileInitializedForOpen.current = false;
      return;
    }
    if (!profileInitializedForOpen.current && currentProfile) {
      profileInitializedForOpen.current = true;
      setClientProfileId(currentProfile.id);
    }
  }, [currentProfile, open]);
  const create = async () => {
    if (creatingRef.current || !selectedProfile) return;
    creatingRef.current = true;
    setCreating(true);
    setError(undefined);
    try {
      onCreated(
        await manager.createInvitation(
          name.trim() || undefined,
          selectedProfile.id,
          canManageConnections ? showtimeConnectionManagementScopes : [],
        ),
      );
      setName("");
      setCanManageConnections(false);
      onOpenChange(false);
    } catch {
      setError("Showtime could not add this client.");
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a new client</DialogTitle>
          <DialogDescription>
            Add a label to make this device easy to recognize, or leave it blank to use the next
            client number.
          </DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          value={name}
          maxLength={80}
          placeholder="For example, Alex’s iPad"
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && !creating && void create()}
        />
        <ProfileControl
          className="w-full"
          state={profilesState}
          selected={selectedProfile}
          onSelect={(profile) => {
            profileInitializedForOpen.current = true;
            setClientProfileId(profile.id);
          }}
          loadResult={profilesResult}
          fullWidth
        />
        <Item variant="outline" render={<label htmlFor="showtime-client-can-manage" />}>
          <ItemContent>
            <ItemTitle>Allow this client to manage connections</ItemTitle>
            <ItemDescription>Let it view, add, connect, and remove other clients.</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Switch
              id="showtime-client-can-manage"
              checked={canManageConnections}
              disabled={creating}
              onCheckedChange={setCanManageConnections}
            />
          </ItemActions>
        </Item>
        <Button type="button" disabled={creating || !selectedProfile} onClick={create}>
          {creating ? "Creating…" : "Create client"}
        </Button>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PairClientDialog({
  manager,
  client,
  onOpenChange,
}: {
  readonly manager: ConnectionManagementClient;
  readonly client: ShowtimePendingClient | undefined;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const [candidates, setCandidates] = React.useState<ReadonlyArray<ShowtimeConnectionCandidate>>(
    [],
  );
  const [selectedUrl, setSelectedUrl] = React.useState("");
  const [discovery, setDiscovery] = React.useState<ShowtimeLocalDiscoveryState>({
    kind: "disabled",
  });
  const [qrCode, setQrCode] = React.useState<string>();
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState<string>();
  React.useEffect(() => {
    if (!client) return;
    let active = true;
    setCandidates([]);
    setSelectedUrl("");
    setDiscovery({ kind: "probing" });
    setQrCode(undefined);
    setCopied(false);
    setError(undefined);
    let timer: number | undefined;
    let consecutiveFailures = 0;
    let expiresAt = Date.parse(client.expiresAt);
    let hasRequestedPairingInfo = false;
    const setExpiredError = () => setError("This connection link has expired.");
    const hasExpired = () => pairingInfoRetryWait(expiresAt, 0) === undefined;
    const scheduleLoad = (delay: number) => {
      const wait = pairingInfoRetryWait(expiresAt, delay);
      if (wait === undefined) {
        setExpiredError();
        return;
      }
      timer = window.setTimeout(load, wait);
    };
    const load = () => {
      if (!active) return;
      if (!canLoadPairingInfo(hasRequestedPairingInfo, expiresAt)) {
        setExpiredError();
        return;
      }
      hasRequestedPairingInfo = true;
      void manager.pairingInfo(client.invitationId).then(
        (info) => {
          if (!active) return;
          if (info.expiresAt === null) {
            setExpiredError();
            return;
          }
          expiresAt = Date.parse(info.expiresAt);
          if (hasExpired()) {
            setExpiredError();
            return;
          }
          consecutiveFailures = 0;
          setDiscovery(info.discovery);
          setCandidates(info.candidates);
          setSelectedUrl((currentUrl) => selectPairingCandidateUrl(info.candidates, currentUrl));
          if (info.discovery.kind === "probing") {
            setError(undefined);
          } else if (info.candidates.length === 0) {
            setError("No local network was found on this computer.");
          } else {
            setError(undefined);
          }
          if (shouldPollPairingInfo(info.discovery)) scheduleLoad(pairingInfoPollDelay);
        },
        () => {
          if (!active) return;
          if (hasExpired()) {
            setExpiredError();
            return;
          }
          consecutiveFailures += 1;
          setError("Showtime could not refresh the connection link. Retrying…");
          scheduleLoad(pairingInfoRetryDelay(consecutiveFailures));
        },
      );
    };
    load();
    return () => {
      active = false;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [client, manager]);
  React.useEffect(() => {
    setQrCode(undefined);
    setCopied(false);
    setError(undefined);
    if (!selectedUrl) return;
    let active = true;
    void QRCode.toDataURL(selectedUrl, { errorCorrectionLevel: "M", margin: 2, width: 320 }).then(
      (value) => active && setQrCode(value),
    );
    return () => {
      active = false;
    };
  }, [selectedUrl]);
  const selected = candidates.find((candidate) => candidate.url === selectedUrl);
  return (
    <Dialog open={client !== undefined} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect {client?.name}</DialogTitle>
          <DialogDescription>
            Open this link on one device within five minutes. It can only be used once.
          </DialogDescription>
        </DialogHeader>
        {candidates.length > 0 && (
          <Select value={selectedUrl} onValueChange={(value) => value && setSelectedUrl(value)}>
            <SelectTrigger>
              <SelectValue>{selected?.label ?? "Choose network"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {candidates.map((candidate) => (
                <SelectItem key={candidate.url} value={candidate.url}>
                  {candidate.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {selectedUrl && (
          <div className="grid gap-2">
            <label htmlFor="generated-showtime-connection-url" className="text-sm font-medium">
              Connection link
            </label>
            <Input
              id="generated-showtime-connection-url"
              type="url"
              value={selectedUrl}
              readOnly
              onFocus={(event) => event.currentTarget.select()}
            />
          </div>
        )}
        {qrCode && (
          <div className="grid justify-items-center">
            <img
              src={qrCode}
              alt={`QR code for connecting ${client?.name ?? "client"}`}
              className="w-full max-w-72"
            />
          </div>
        )}
        {discovery.kind === "probing" && (
          <p className="text-sm text-muted-foreground">Finding an easy local address…</p>
        )}
        {discovery.kind === "degraded" && candidates.length > 0 && (
          <p className="text-sm text-muted-foreground">
            The easy local name is unavailable on this network. The IP address below will still
            work.
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          disabled={!selectedUrl}
          onClick={async () => {
            try {
              await copyText(selectedUrl);
              setCopied(true);
              setError(undefined);
            } catch {
              setError(
                "Could not copy automatically. Press and hold the connection link above to copy it.",
              );
            }
          }}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? "Copied" : "Copy connection link"}
        </Button>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
