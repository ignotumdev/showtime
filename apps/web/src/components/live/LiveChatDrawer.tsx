import * as React from "react";
import type { ChatChannelId, ShowId } from "@showtime/contracts";
import { LibraryIcon, MessageCircleIcon } from "lucide-react";
import { ChatDrawer } from "@/components/chats/ChatDrawer";
import { ChatPresetLauncher } from "@/components/chats/ChatPresetLauncher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function LiveChatDrawer({ showId }: { readonly showId: ShowId }) {
  const [selectedChannelId, setSelectedChannelId] = React.useState<ChatChannelId>();

  return (
    <>
      <ChatPresetLauncher
        showId={showId}
        channelId={selectedChannelId}
        trigger={({ disabled, onClick }) => (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="fixed top-12 left-3 z-30 sm:left-4"
            aria-label="Open message presets"
            disabled={disabled}
            onClick={onClick}
          >
            <LibraryIcon />
          </Button>
        )}
      />
      <ChatDrawer
        showId={showId}
        onSelectedChannelChange={setSelectedChannelId}
        trigger={(unreadCount) => (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="fixed top-12 right-3 z-30 sm:right-4"
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
    </>
  );
}
