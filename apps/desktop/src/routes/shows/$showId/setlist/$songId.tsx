import { createFileRoute, useParams } from "@tanstack/react-router";
import { ShowComingSoon } from "@/components/shows/ShowComingSoon";

export const Route = createFileRoute("/shows/$showId/setlist/$songId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { songId } = useParams({ from: "/shows/$showId/setlist/$songId" });

  return <ShowComingSoon title={`Song: ${songId}`} />;
}
