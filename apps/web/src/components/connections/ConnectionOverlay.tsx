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
import * as React from "react";
import { forgetBrowserConnection } from "@/connection";
import { connectionState, type ConnectionStatus } from "@/connection-state";
import { isDesktopHost } from "@/platform";
import { useHasBrowserConnection } from "@/browser-connection-state";

export function ConnectionOverlay({ status }: { readonly status: ConnectionStatus }) {
  const desktop = isDesktopHost();
  const hasBrowserConnection = useHasBrowserConnection();
  const pairedBrowser = !desktop && hasBrowserConnection;
  const [forgetError, setForgetError] = React.useState<string>();

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

  if (status === "disabled") {
    return (
      <ConnectionEmpty
        icon={<WifiOffIcon />}
        title="Connections are disabled"
        description="Remote connections are turned off on the show computer. Showtime will reconnect automatically when they are enabled."
      >
        <RecoveryActions pairedBrowser={pairedBrowser} onForgetError={setForgetError} />
        {forgetError && <p className="text-sm text-destructive">{forgetError}</p>}
      </ConnectionEmpty>
    );
  }

  if (status === "revoked") {
    return (
      <ConnectionEmpty
        icon={<WifiOffIcon />}
        title="This device no longer has access"
        description="Forget this connection, then ask the engineer for a new connection link."
      >
        <RecoveryActions
          pairedBrowser={pairedBrowser}
          onForgetError={setForgetError}
          retry={false}
        />
        {forgetError && <p className="text-sm text-destructive">{forgetError}</p>}
      </ConnectionEmpty>
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
      <RecoveryActions pairedBrowser={pairedBrowser} onForgetError={setForgetError} />
      {forgetError && <p className="text-sm text-destructive">{forgetError}</p>}
    </ConnectionEmpty>
  );
}

function RecoveryActions({
  pairedBrowser,
  onForgetError,
  retry = true,
}: {
  readonly pairedBrowser: boolean;
  readonly onForgetError: (message: string | undefined) => void;
  readonly retry?: boolean;
}) {
  return (
    <>
      {retry && (
        <Button type="button" variant="outline" onClick={() => connectionState.retryNow()}>
          <RefreshCwIcon /> Retry now
        </Button>
      )}
      {pairedBrowser && (
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            const result = forgetBrowserConnection();
            onForgetError(result.status === "failed" ? result.message : undefined);
          }}
        >
          Forget this connection
        </Button>
      )}
    </>
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
