import { createFileRoute } from "@tanstack/react-router";
import { ShowComingSoon } from "@/components/shows/ShowComingSoon";

export const Route = createFileRoute("/live/$showId")({
  component: RouteComponent,
});

function RouteComponent() {
  return <ShowComingSoon title="Live" />;
}
