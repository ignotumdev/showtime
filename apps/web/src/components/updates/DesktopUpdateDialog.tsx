import * as React from "react";
import type { ShowtimeDesktopUpdateState } from "@showtime/shared";
import { DownloadIcon, RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const triggerLabel = (state: ShowtimeDesktopUpdateState) => {
  switch (state.kind) {
    case "available":
      return "Update available";
    case "downloading":
      return `Downloading ${Math.round(state.percent)}%`;
    case "ready":
      return "Restart to update";
    case "blocked-live":
      return "Update paused";
    case "error":
      return "Update issue";
    default:
      return undefined;
  }
};

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  return `${(bytes / 1_048_576).toFixed(bytes >= 10_485_760 ? 0 : 1)} MB`;
};

export function DesktopUpdateDialog() {
  const bridge = window.showtime;
  const [state, setState] = React.useState<ShowtimeDesktopUpdateState>();
  const [open, setOpen] = React.useState(false);
  const [confirmInstall, setConfirmInstall] = React.useState(false);

  React.useEffect(() => {
    if (!bridge) return;
    const unsubscribe = bridge.onUpdateState(setState);
    void bridge.updateState().then(setState);
    return unsubscribe;
  }, [bridge]);

  if (!bridge || !state) return null;
  const label = triggerLabel(state);
  if (!label) return null;

  const version = "version" in state ? state.version : undefined;
  const download = () => void bridge.downloadUpdate().then(setState);
  const check = () => void bridge.checkForUpdates().then(setState);
  const install = () => void bridge.installUpdate().then(setState);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setConfirmInstall(false);
      }}
    >
      <DialogTrigger render={<Button variant="ghost" size="sm" aria-label={label} />}>
        {state.kind === "downloading" ? (
          <RefreshCwIcon className="animate-spin" />
        ) : (
          <DownloadIcon />
        )}
        <span className="hidden md:inline">{label}</span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{confirmInstall ? "Restart Showtime now?" : "Showtime update"}</DialogTitle>
          <DialogDescription>
            {confirmInstall
              ? "The app and its local server will close. Connected devices will disconnect until Showtime restarts."
              : `Installed version ${state.currentVersion}${version ? ` · Available version ${version}` : ""}`}
          </DialogDescription>
        </DialogHeader>

        {!confirmInstall && <UpdateStatus state={state} />}

        <DialogFooter showCloseButton={!confirmInstall}>
          {confirmInstall ? (
            <>
              <Button variant="outline" onClick={() => setConfirmInstall(false)}>
                Not now
              </Button>
              <Button onClick={install}>Confirm restart</Button>
            </>
          ) : state.kind === "available" ? (
            <Button onClick={download}>Download update</Button>
          ) : state.kind === "ready" ? (
            <Button onClick={() => setConfirmInstall(true)}>Install &amp; restart</Button>
          ) : state.kind === "blocked-live" ? (
            <Button
              onClick={state.action === "download" ? download : () => setConfirmInstall(true)}
            >
              Try again
            </Button>
          ) : state.kind === "error" ? (
            <Button onClick={state.retry === "check" ? check : download}>
              {state.retry === "check" ? "Check again" : "Retry download"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UpdateStatus({ state }: { readonly state: ShowtimeDesktopUpdateState }) {
  if (state.kind === "downloading") {
    return (
      <div className="grid gap-2" aria-live="polite">
        <progress className="w-full" max={100} value={state.percent}>
          {Math.round(state.percent)}%
        </progress>
        <p className="text-muted-foreground">
          {formatBytes(state.transferred)} of {formatBytes(state.total)} ·{" "}
          {Math.round(state.percent)}%
        </p>
      </div>
    );
  }
  if (state.kind === "blocked-live") {
    return (
      <p role="status">
        Updates are paused while a show is Live. End Live on every connected device, then try again.
      </p>
    );
  }
  if (state.kind === "error") return <p role="alert">{state.message}</p>;
  if ((state.kind === "available" || state.kind === "ready") && state.releaseNotes) {
    return (
      <div className="grid gap-2">
        <strong>What changed</strong>
        <p className="max-h-48 overflow-y-auto whitespace-pre-wrap text-muted-foreground">
          {state.releaseNotes}
        </p>
      </div>
    );
  }
  return (
    <p>
      {state.kind === "ready"
        ? "The update is downloaded and ready to install."
        : "A newer version of Showtime is available."}
    </p>
  );
}
