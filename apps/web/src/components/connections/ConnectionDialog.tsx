import * as React from "react";
import QRCode from "qrcode";
import { CheckIcon, CopyIcon, PlusIcon, Trash2Icon, WifiIcon } from "lucide-react";
import type {
  ShowtimeConnectionCandidate,
  ShowtimeConnectionsState,
  ShowtimeLocalDiscoveryState,
  ShowtimePendingClient,
} from "@showtime/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

const emptyState: ShowtimeConnectionsState = { enabled: false, clients: [] };

const timeUntil = (expiresAt: string, now: number) => {
  const remaining = Math.max(0, Date.parse(expiresAt) - now);
  if (remaining === 0) return "Link expired";
  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1_000);
  return `Link expires in ${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export function ConnectionDialog() {
  const [open, setOpen] = React.useState(false);
  const [state, setState] = React.useState(emptyState);
  const [createOpen, setCreateOpen] = React.useState(false);
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
      const value = await window.showtime!.connectionsState();
      if (generation !== refreshGeneration.current) return;
      setState(value);
      setLoadError(undefined);
    } catch {
      if (generation === refreshGeneration.current)
        setLoadError("Showtime could not load connections.");
    } finally {
      refreshInFlight.current = false;
    }
  }, []);

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
      setState(await window.showtime!.setConnectionsEnabled(enabled));
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
      setState(await window.showtime!.removeConnection(id));
      if (pairingClient?.invitationId === id) setPairingClient(undefined);
    } catch {
      setError("Showtime could not remove this client.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button size="sm" variant="ghost" />}>
          <WifiIcon /> Connections
        </DialogTrigger>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Connections</DialogTitle>
            <DialogDescription>
              Manage access to Showtime from devices on this network.
            </DialogDescription>
          </DialogHeader>
          <Item variant="outline" render={<label htmlFor="showtime-connections-enabled" />}>
            <ItemContent>
              <ItemTitle>Allow connections</ItemTitle>
              <ItemDescription>Host the web app and let approved devices connect.</ItemDescription>
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
                    <ItemTitle>{client.name}</ItemTitle>
                    <ItemDescription>
                      {client.kind === "pending"
                        ? timeUntil(client.expiresAt, now)
                        : connected
                          ? "Connected now"
                          : "Not currently connected"}
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
                  </ItemActions>
                </Item>
              );
            })}
          </ItemGroup>
          {state.enabled && (
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
            <p className="text-sm text-muted-foreground">No clients have access yet.</p>
          )}
          {(error ?? loadError) && (
            <p role="alert" className="text-sm text-destructive">
              {error ?? loadError}
            </p>
          )}
        </DialogContent>
      </Dialog>
      <CreateClientDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={setState} />
      <PairClientDialog
        key={pairingClient?.invitationId ?? "closed"}
        client={pairingClient}
        onOpenChange={(next) => !next && setPairingClient(undefined)}
      />
    </>
  );
}

function CreateClientDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onCreated: (state: ShowtimeConnectionsState) => void;
}) {
  const [name, setName] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const creatingRef = React.useRef(false);
  const [error, setError] = React.useState<string>();
  const create = async () => {
    if (creatingRef.current) return;
    creatingRef.current = true;
    setCreating(true);
    setError(undefined);
    try {
      onCreated(await window.showtime!.createInvitation(name.trim() || undefined));
      setName("");
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
        <Button type="button" disabled={creating} onClick={create}>
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
  client,
  onOpenChange,
}: {
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
      void window.showtime!.pairingInfo(client.invitationId).then(
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
  }, [client]);
  React.useEffect(() => {
    setQrCode(undefined);
    setCopied(false);
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
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto">
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
            await navigator.clipboard.writeText(selectedUrl);
            setCopied(true);
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
