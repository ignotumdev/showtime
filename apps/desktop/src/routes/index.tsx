import { createFileRoute } from "@tanstack/react-router";
import { ShowDeleteDialog } from "@/components/shows/ShowDeleteDialog";
import { ShowFormDialog } from "@/components/shows/ShowFormDialog";
import { ShowList } from "@/components/shows/ShowList";

export const Route = createFileRoute("/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-xl items-center">
      <ShowList />
      <ShowFormDialog />
      <ShowDeleteDialog />
    </main>
  );
}
