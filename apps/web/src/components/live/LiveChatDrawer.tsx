import type { ShowId } from "@showtime/contracts";
import { MessageCircleIcon } from "lucide-react";
import { ChatDrawer } from "@/components/chats/ChatDrawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function LiveChatDrawer({ showId }: { readonly showId: ShowId }) {
  return (
    <ChatDrawer
      showId={showId}
      trigger={(unreadCount) => (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="fixed top-12 left-3 z-30 sm:left-4"
          aria-label={`Open chat${unreadCount > 0 ? `, ${unreadCount} unread messages` : ""}`}
        >
          <MessageCircleIcon />
          {unreadCount > 0 && (
            <Badge className="absolute -top-2 -right-2 min-w-5 justify-center px-1">
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      )}
    />
  );
}
