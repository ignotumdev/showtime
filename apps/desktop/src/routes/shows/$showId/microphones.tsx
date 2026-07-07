import { createFileRoute } from "@tanstack/react-router";
import { ShowComingSoon } from "@/components/shows/ShowComingSoon";

export const Route = createFileRoute("/shows/$showId/microphones")({
  component: RouteComponent,
});

function RouteComponent() {
  return <ShowComingSoon title="Microphones" />;
}
