import { createFileRoute } from "@tanstack/react-router";
import { ShowLayout } from "@/components/shows/ShowLayout";

export const Route = createFileRoute("/shows/$showId")({
  component: ShowLayout,
});
