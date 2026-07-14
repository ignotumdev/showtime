import * as React from "react";
import type { ShowId } from "@showtime/contracts";
import { MessageCircleIcon } from "lucide-react";
import { ChatWorkspace } from "@/components/chats/ChatWorkspace";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

export function LiveChatDrawer({ showId }: { readonly showId: ShowId }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Drawer open={open} onOpenChange={setOpen} swipeDirection="left">
      <DrawerTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="fixed top-12 left-3 z-30 sm:left-4"
          />
        }
      >
        <MessageCircleIcon />
        <span className="sr-only">Open show chat</span>
      </DrawerTrigger>
      <DrawerContent className="data-[swipe-axis=x]:[--drawer-content-width:min(44rem,100vw)]">
        <DrawerHeader>
          <DrawerTitle>Show chat</DrawerTitle>
          <DrawerDescription>Messages and channels for this show.</DrawerDescription>
        </DrawerHeader>
        <div className="min-h-0 flex-1 p-3 pt-2">
          <ChatWorkspace showId={showId} active={open} compact />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
