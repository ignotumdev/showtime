import { createFileRoute } from "@tanstack/react-router";
import type { ShowId } from "@showtime/contracts";
import { ChatWorkspace } from "@/components/chats/ChatWorkspace";

export const Route = createFileRoute("/shows/$showId/chat")({
  component: RouteComponent,
});

function RouteComponent() {
  const { showId } = Route.useParams();
  return <ChatWorkspace showId={showId as ShowId} />;
}
