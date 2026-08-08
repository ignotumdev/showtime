import { createFileRoute } from "@tanstack/react-router";
import type { ShowId } from "@showtime/contracts";
import { ChatPresetsWorkspace } from "@/components/chats/ChatPresetsWorkspace";

export const Route = createFileRoute("/shows/$showId/presets")({ component: RouteComponent });

function RouteComponent() {
  const { showId } = Route.useParams();
  return <ChatPresetsWorkspace showId={showId as ShowId} />;
}
