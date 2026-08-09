import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/shows/$showId/settings/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/shows/$showId/settings/$section",
      params: { showId: params.showId, section: "general" },
    });
  },
});
