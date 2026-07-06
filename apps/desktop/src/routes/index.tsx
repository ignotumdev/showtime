import { createFileRoute } from "@tanstack/react-router";
import { ShowDeleteDialog } from "@/components/shows/ShowDeleteDialog";
import { ShowFormDialog } from "@/components/shows/ShowFormDialog";
import { ShowList } from "@/components/shows/ShowList";
import React from "react";
import { TitleBar } from "@/components/TitleBar";
import { ShowMutationStatus } from "@/components/shows/ShowMutationStatus";

export const Route = createFileRoute("/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <React.Fragment>
      <TitleBar />
      <div className="min-h-screen px-3 py-10">
        <main className="mx-auto flex h-[calc(100vh-5rem)] min-h-0 w-full max-w-xl items-center">
          <ShowList />
          <ShowFormDialog />
          <ShowDeleteDialog />
        </main>
      </div>
      <ShowMutationStatus />
    </React.Fragment>
  );
}
