import * as React from "react";
import { Outlet, createRootRoute } from "@tanstack/react-router";
import { isDesktopHost } from "@/platform";
import { useHasBrowserConnection } from "@/browser-connection-state";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  const hasBrowserConnection = useHasBrowserConnection();
  if (
    !isDesktopHost() &&
    !hasBrowserConnection &&
    !import.meta.env.VITE_SHOWTIME_RPC_WEBSOCKET_URL
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold">Connect to Showtime</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Open Showtime on the show computer, choose Connect device, and scan its QR code. Both
            devices must be on the same local network.
          </p>
        </div>
      </main>
    );
  }
  return (
    <React.Fragment>
      <div className="min-h-screen">
        <Outlet />
      </div>
    </React.Fragment>
  );
}
