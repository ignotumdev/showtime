import * as React from "react";
import { DownloadIcon, ShareIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isStandalonePwa, stagePwaConnectionHandoff } from "@/pwa";

interface BeforeInstallPromptEvent extends Event {
  readonly userChoice: Promise<{ readonly outcome: "accepted" | "dismissed" }>;
  prompt(): Promise<void>;
}

const isIos = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export function PwaInstallButton({ compact = false }: { readonly compact?: boolean }) {
  const [prompt, setPrompt] = React.useState<BeforeInstallPromptEvent>();
  const [showIosHelp, setShowIosHelp] = React.useState(false);
  const [installed, setInstalled] = React.useState(isStandalonePwa);
  const ios = isIos();

  React.useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(undefined);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || (!prompt && !ios)) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={compact ? "icon-sm" : "default"}
        aria-label={compact ? "Install Showtime" : undefined}
        onClick={async () => {
          if (!prompt) {
            stagePwaConnectionHandoff();
            setShowIosHelp(true);
            return;
          }
          await prompt.prompt();
          const choice = await prompt.userChoice;
          if (choice.outcome === "accepted") setInstalled(true);
          setPrompt(undefined);
        }}
      >
        <DownloadIcon /> {!compact && "Install Showtime"}
      </Button>
      <Dialog open={showIosHelp} onOpenChange={setShowIosHelp}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Install Showtime</DialogTitle>
            <DialogDescription>
              In Safari, tap the Share button, then choose Add to Home Screen. Showtime will open
              like an app and carry over this connection on current iOS versions. If it still asks
              to connect, paste the full connection link.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShareIcon className="size-4" /> Share, then Add to Home Screen
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
