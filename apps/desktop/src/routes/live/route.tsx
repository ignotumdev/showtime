import { TitleBar } from "@/components/TitleBar";
import { useShowFromParams } from "@/frontend/shows/useShowFromParams";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import React from "react";

export const Route = createFileRoute("/live")({
  component: RouteComponent,
});

function RouteComponent() {
  const { show: liveShow } = useShowFromParams();

  return (
    <React.Fragment>
      <TitleBar hideName={true} liveShow={liveShow} stack="below-content" />
      <div className="min-h-screen px-3 py-10">
        <Outlet />
      </div>
    </React.Fragment>
  );
}
