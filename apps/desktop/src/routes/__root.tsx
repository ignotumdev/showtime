import * as React from "react";
import { Outlet, createRootRoute } from "@tanstack/react-router";
import { TitleBar } from "@/components/TitleBar";
import { ShowMutationStatus } from "@/components/shows/ShowMutationStatus";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <React.Fragment>
      <TitleBar />
      <div className="min-h-screen px-3 py-10">
        <Outlet />
      </div>
      <ShowMutationStatus />
    </React.Fragment>
  );
}
