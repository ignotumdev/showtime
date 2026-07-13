import { createFileRoute } from "@tanstack/react-router";
import { ShowDeleteDialog } from "@/components/shows/ShowDeleteDialog";
import { ShowFormDialog } from "@/components/shows/ShowFormDialog";
import { ShowList } from "@/components/shows/ShowList";
import React from "react";
import { TitleBar } from "@/components/TitleBar";
import { ShowMutationStatus } from "@/components/shows/ShowMutationStatus";
import { ProfileSwitcher } from "@/components/profiles/ProfileSwitcher";

export const Route = createFileRoute("/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <React.Fragment>
      <TitleBar />
      <div className="h-svh bg-background px-3 pt-10 sm:px-4">
        <main className="mx-auto flex h-full min-h-0 w-full max-w-xl items-center py-3 sm:py-8">
          <ShowList />
          <ShowFormDialog />
          <ShowDeleteDialog />
        </main>
      </div>
      <div className="fixed right-4 bottom-4 z-40">
        <ProfileSwitcher />
      </div>
      <ShowMutationStatus />
    </React.Fragment>
  );
}
