import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createHashHistory, createRouter } from "@tanstack/react-router";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RegistryProvider as AtomProvider } from "@effect/atom-react";
import { routeTree } from "./routeTree.gen";
import "./styles.css";
import { capturePairingFragment, hasBrowserConnection } from "./connection";
import { connectionState, useConnectionSnapshot } from "./connection-state";
import { ConnectionOverlay } from "./components/connections/ConnectionOverlay";
import { isDesktopHost } from "./platform";
import { AsyncResult } from "effect/unstable/reactivity";
import { useAtomValue } from "@effect/atom-react";
import { showsAtom } from "./client";

const pairing = await capturePairingFragment();
document.documentElement.classList.add("dark");

const router = createRouter({ routeTree, history: createHashHistory() });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {pairing.status === "failed" ? (
      <main className="grid min-h-screen place-content-center gap-2 bg-background p-6 text-center text-foreground">
        <h1 className="text-lg font-semibold">Could not connect to Showtime</h1>
        <p className="max-w-md text-sm text-muted-foreground">{pairing.message}</p>
      </main>
    ) : (
      <SynchronizedApp />
    )}
  </React.StrictMode>,
);

function SynchronizedApp() {
  const connection = useConnectionSnapshot();
  const expectsConnection =
    isDesktopHost() ||
    hasBrowserConnection() ||
    Boolean(import.meta.env.VITE_SHOWTIME_RPC_WEBSOCKET_URL);
  return (
    <AtomProvider key={connection.generation}>
      <TooltipProvider>
        {expectsConnection && <ConnectionCoordinator />}
        <div
          className="min-h-screen bg-[#0a0a0a]"
          aria-hidden={expectsConnection && connection.status !== "connected"}
          inert={expectsConnection && connection.status !== "connected" ? true : undefined}
        >
          <RouterProvider router={router} />
        </div>
        {expectsConnection && connection.status !== "connected" && (
          <ConnectionOverlay status={connection.status} />
        )}
      </TooltipProvider>
    </AtomProvider>
  );
}

function ConnectionCoordinator() {
  const shows = useAtomValue(showsAtom);
  React.useEffect(() => {
    if (AsyncResult.isSuccess(shows)) connectionState.connected();
    else connectionState.disconnected();
  }, [shows]);
  return null;
}
