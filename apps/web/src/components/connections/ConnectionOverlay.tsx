import { CableIcon, RefreshCwIcon, WifiOffIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { forgetBrowserConnection, hasBrowserConnection } from "@/connection";
import type { ConnectionStatus } from "@/connection-state";
import { isDesktopHost } from "@/platform";

export function ConnectionOverlay({ status }: { readonly status: ConnectionStatus }) {
  const desktop = isDesktopHost();
  const pairedBrowser = !desktop && hasBrowserConnection();

  if (status === "connecting") {
    return (
      <ConnectionEmpty
        icon={<Spinner />}
        title="Connecting to Showtime"
        description="Waiting for the show computer and loading the latest show data."
      />
    );
  }

  if (status === "reconnecting") {
    return (
      <ConnectionEmpty
        icon={<RefreshCwIcon />}
        title="Reconnecting to Showtime"
        description="The connection was interrupted. Showtime will reload the latest data automatically."
      />
    );
  }

  return (
    <ConnectionEmpty
      icon={desktop ? <CableIcon /> : <WifiOffIcon />}
      title={desktop ? "Showtime is reconnecting" : "Showtime is unavailable"}
      description={
        desktop
          ? "The local show server is not responding. Retry the connection before continuing."
          : "The show computer may be offline, connections may be disabled, or this device may have been removed."
      }
    >
      <Button type="button" variant="outline" onClick={() => window.location.reload()}>
        <RefreshCwIcon /> Retry now
      </Button>
      {pairedBrowser && (
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            forgetBrowserConnection();
            window.location.reload();
          }}
        >
          Forget this connection
        </Button>
      )}
    </ConnectionEmpty>
  );
}

function ConnectionEmpty({
  icon,
  title,
  description,
  children,
}: {
  readonly icon: React.ReactNode;
  readonly title: string;
  readonly description: string;
  readonly children?: React.ReactNode;
}) {
  return (
    <main className="fixed inset-0 z-50 flex min-h-screen bg-background p-6">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">{icon}</EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>
        {children && <EmptyContent>{children}</EmptyContent>}
      </Empty>
    </main>
  );
}
