import { ShowComingSoon } from "@/components/shows/ShowComingSoon";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/shows/$showId/setlist/")({
  component: RouteComponent,
});

function RouteComponent() {
  return <ShowComingSoon title="All songs" />;
}
