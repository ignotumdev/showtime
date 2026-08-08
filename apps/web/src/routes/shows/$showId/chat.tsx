import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { ChatChannelId, ShowId } from "@showtime/contracts";
import { consumeChatOpenRequest, subscribeChatOpenRequests } from "@/chats/ChatNavigation";
import { ChatWorkspace } from "@/components/chats/ChatWorkspace";

export const Route = createFileRoute("/shows/$showId/chat")({ component: RouteComponent });

function RouteComponent() {
  const { showId } = Route.useParams();
  const typedShowId = showId as ShowId;
  const [requestedChannelId, setRequestedChannelId] = React.useState<ChatChannelId | undefined>(
    () => consumeChatOpenRequest(typedShowId)?.channelId,
  );

  React.useEffect(() => {
    const consumeRequest = () => {
      const request = consumeChatOpenRequest(typedShowId);
      if (request) setRequestedChannelId(request.channelId);
    };
    consumeRequest();
    return subscribeChatOpenRequests(consumeRequest);
  }, [typedShowId]);

  return (
    <ChatWorkspace
      showId={typedShowId}
      requestedChannelId={requestedChannelId}
      onSelectedChannelChange={setRequestedChannelId}
    />
  );
}
