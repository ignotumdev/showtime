import * as React from "react";
import { createPortal } from "react-dom";
import { Toast } from "@base-ui/react/toast";
import { XIcon } from "lucide-react";
import { openChat } from "@/chats/ChatNavigation";
import { ChatMessageBody } from "@/components/chats/ChatMessageBody";
import { ProfileAvatar } from "@/components/profiles/ProfileAvatar";
import { profileColorClassNames } from "@/components/profiles/profile-color";
import { formatClientTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import {
  notificationManager,
  subscribeNotificationBlinks,
  type AppNotification,
} from "./NotificationCenter";

export function NotificationProvider({ children }: { readonly children: React.ReactNode }) {
  const [blink, setBlink] = React.useState({
    key: 0,
    color: profileColorClassNames.neutral.border,
  });

  // Descendant notification coordinators publish from passive effects. Subscribe
  // during layout so their initial catch-up blinks cannot be missed.
  React.useLayoutEffect(
    () =>
      subscribeNotificationBlinks((color) => {
        setBlink((current) => ({
          key: current.key + 1,
          color: profileColorClassNames[color ?? "neutral"].border,
        }));
      }),
    [],
  );

  return (
    <Toast.Provider limit={5} timeout={6_000} toastManager={notificationManager}>
      {children}
      {blink.key > 0 &&
        createPortal(
          <div
            key={blink.key}
            aria-hidden="true"
            className={cn(
              "pointer-events-none fixed -inset-[6px] z-[110] animate-notification-border-blink rounded-[24px] border-[12px] opacity-0",
              blink.color,
            )}
          />,
          document.body,
        )}
      <NotificationViewport />
    </Toast.Provider>
  );
}

function NotificationViewport() {
  const { toasts } = Toast.useToastManager<AppNotification>();
  return (
    <Toast.Portal>
      <Toast.Viewport className="fixed top-3 left-1/2 z-[100] flex w-[min(26rem,calc(100vw-1.5rem))] -translate-x-1/2 flex-col gap-2 outline-none sm:top-4">
        {toasts.map((toast) => {
          const chat = toast.data?.chat;
          const timestamp = toast.data?.timestamp;
          const openNotificationChat = async () => {
            if (!chat) return;
            await openChat({ showId: chat.showId, channelId: chat.channelId });
            notificationManager.close(toast.id);
          };
          return (
            <Toast.Root
              key={toast.id}
              toast={toast}
              swipeDirection="up"
              className="relative rounded-lg border bg-popover p-4 pr-10 text-popover-foreground shadow-lg transition data-ending-style:-translate-y-full data-ending-style:opacity-0 data-starting-style:-translate-y-2 data-starting-style:opacity-0"
              onClick={(event) => {
                if ((event.target as HTMLElement).closest("[data-notification-dismiss]")) return;
                void openNotificationChat();
              }}
            >
              <Toast.Content
                role={chat ? "button" : undefined}
                tabIndex={chat ? 0 : undefined}
                className={cn(
                  "flex items-start gap-3",
                  chat &&
                    "cursor-pointer rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                )}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  void openNotificationChat();
                }}
              >
                {chat?.senderName && (
                  <ProfileAvatar
                    name={chat.senderName}
                    color={chat.senderColor}
                    className="mt-0.5"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <Toast.Title className="flex min-w-0 items-baseline gap-2 text-sm">
                    <span className="truncate font-semibold">{toast.title}</span>
                    {chat && !chat.summary && (
                      <span className="truncate text-xs text-muted-foreground">
                        #{chat.channelName}
                      </span>
                    )}
                    {timestamp !== undefined && (
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                        {formatClientTime(timestamp)}
                      </span>
                    )}
                  </Toast.Title>
                  {toast.description && (
                    <>
                      <Toast.Description
                        className={cn(
                          "mt-1 line-clamp-3 text-sm text-muted-foreground",
                          toast.data?.descriptionParts?.length && "sr-only",
                        )}
                      >
                        {toast.description}
                      </Toast.Description>
                      {toast.data?.descriptionParts?.length ? (
                        <div className="mt-1 line-clamp-3 text-sm text-muted-foreground">
                          <ChatMessageBody
                            body={toast.data?.description ?? ""}
                            parts={toast.data.descriptionParts}
                          />
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </Toast.Content>
              <Toast.Close
                aria-label="Dismiss notification"
                data-notification-dismiss
                className="absolute top-2 right-2 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <XIcon className="size-4" />
              </Toast.Close>
            </Toast.Root>
          );
        })}
      </Toast.Viewport>
    </Toast.Portal>
  );
}
