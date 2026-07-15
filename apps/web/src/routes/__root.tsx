import * as React from "react";
import { Outlet, createRootRoute } from "@tanstack/react-router";
import { isDesktopHost } from "@/platform";
import { useHasBrowserConnection } from "@/browser-connection-state";
import { ConnectToShowtime } from "@/components/connections/ConnectToShowtime";

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
    return <ConnectToShowtime />;
  }
  return (
    <React.Fragment>
      <div className="app-height">
        <Outlet />
      </div>
    </React.Fragment>
  );
}
