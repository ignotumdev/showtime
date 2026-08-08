import * as React from "react";
import type { ShowtimeDesktopUpdateState } from "@showtime/shared";
import { DownloadIcon, RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
    case "recovery-required":
      return "Update issue";
    default:
      return undefined;
  }
};

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  return `${(bytes / 1_048_576).toFixed(bytes >= 10_485_760 ? 0 : 1)} MB`;
};

export function useDesktopUpdateState() {
  const bridge = window.showtime;
  const [state, setState] = React.useState<ShowtimeDesktopUpdateState>();
  const applyState = React.useCallback((nextState: ShowtimeDesktopUpdateState) => {
    setState(nextState);
  }, []);

  React.useEffect(() => {
    if (!bridge) return;
    const unsubscribe = bridge.onUpdateState(applyState);
    void bridge.updateState().then(applyState);
    return unsubscribe;
  }, [applyState, bridge]);

  return { bridge, state, applyState } as const;
}

export function DesktopUpdateDialog({ showIdle = false }: { readonly showIdle?: boolean }) {
  const updateState = useDesktopUpdateState();

  return <DesktopUpdateDialogView {...updateState} showIdle={showIdle} />;
}

type DesktopUpdateDialogViewProps = ReturnType<typeof useDesktopUpdateState> & {
  readonly showIdle?: boolean;
};

export function DesktopUpdateDialogView({
  bridge,
  state,
  applyState,
  showIdle = false,
}: DesktopUpdateDialogViewProps) {
  const [open, setOpen] = React.useState(false);
  const [confirmInstall, setConfirmInstall] = React.useState(false);

  React.useEffect(() => {
    if (
      state?.kind === "blocked-live" ||
      state?.kind === "error" ||
      state?.kind === "recovery-required"
    ) {
      setConfirmInstall(false);
    }
  }, [state]);

  if (!bridge || !state) return null;
  const label = triggerLabel(state);
  const download = () => void bridge.downloadUpdate().then(applyState);
  const check = () => void bridge.checkForUpdates().then(applyState);
  const install = () => void bridge.installUpdate().then(applyState);
  if (!label) {
    if (!showIdle) return null;
    if (state.kind === "unsupported") return <Button disabled>Updates unavailable</Button>;
    if (state.kind === "checking") {
      return (
        <Button disabled variant="outline">
          <RefreshCwIcon className="animate-spin" /> Checking…
        </Button>
      );
    }
    return (
      <Button variant="outline" onClick={check}>
        Check for updates
      </Button>
    );
  }

  const version = "version" in state ? state.version : undefined;

  return (
    <>
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
            <DialogTitle>Showtime update</DialogTitle>
            <DialogDescription>
              {`Installed version ${state.currentVersion}${version ? ` · Available version ${version}` : ""}`}
            </DialogDescription>
          </DialogHeader>

          <UpdateStatus state={state} />

          <DialogFooter showCloseButton>
            {state.kind === "available" ? (
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
              <Button
                onClick={
                  state.retry === "check"
                    ? check
                    : state.retry === "install"
                      ? () => setConfirmInstall(true)
                      : download
                }
              >
                {state.retry === "check"
                  ? "Check again"
                  : state.retry === "install"
                    ? "Retry install"
                    : "Retry download"}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirmInstall} onOpenChange={setConfirmInstall}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia>
              <RefreshCwIcon />
            </AlertDialogMedia>
            <AlertDialogTitle>Restart Showtime now?</AlertDialogTitle>
            <AlertDialogDescription>
              The app and its local server will close. Connected devices will disconnect until
              Showtime restarts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not now</AlertDialogCancel>
            <AlertDialogAction onClick={install}>Confirm restart</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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
  if (state.kind === "error" || state.kind === "recovery-required") {
    return <p role="alert">{state.message}</p>;
  }
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
