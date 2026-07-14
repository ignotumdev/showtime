import * as React from "react";
import { createPortal } from "react-dom";
import { Toast } from "@base-ui/react/toast";
import { XIcon } from "lucide-react";
import { ProfileAvatar } from "@/components/profiles/ProfileAvatar";
import {
  notificationManager,
  subscribeNotifications,
  type AppNotification,
} from "./NotificationCenter";

export function NotificationProvider({ children }: { readonly children: React.ReactNode }) {
  const [blinkKey, setBlinkKey] = React.useState(0);

  React.useEffect(
    () =>
      subscribeNotifications((notification) => {
        if (notification.kind === "chat") setBlinkKey((current) => current + 1);
      }),
    [],
  );

  return (
    <Toast.Provider limit={5} timeout={6_000} toastManager={notificationManager}>
      {children}
      {blinkKey > 0 &&
        createPortal(
          <div
            key={blinkKey}
            aria-hidden="true"
            className="pointer-events-none fixed inset-1 z-[110] animate-notification-border-blink rounded-xl border-4 border-sky-500 opacity-0"
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
        {toasts.map((toast) => (
          <Toast.Root
            key={toast.id}
            toast={toast}
            swipeDirection="up"
            className="relative rounded-lg border bg-popover p-4 pr-10 text-popover-foreground shadow-lg transition data-ending-style:-translate-y-full data-ending-style:opacity-0 data-starting-style:-translate-y-2 data-starting-style:opacity-0"
          >
            <Toast.Content className="flex items-start gap-3">
              {toast.data?.chat && (
                <ProfileAvatar
                  name={toast.data.chat.senderName}
                  color={toast.data.chat.senderColor}
                  className="mt-0.5"
                />
              )}
              <div className="min-w-0 flex-1">
                <Toast.Title className="flex min-w-0 items-baseline gap-2 text-sm">
                  <span className="truncate font-semibold">{toast.title}</span>
                  {toast.data?.chat && (
                    <span className="truncate text-xs text-muted-foreground">
                      {toast.data.chat.showName} · #{toast.data.chat.channelName}
                    </span>
                  )}
                </Toast.Title>
                {toast.description && (
                  <Toast.Description className="mt-1 line-clamp-3 text-sm text-muted-foreground">
                    {toast.description}
                  </Toast.Description>
                )}
              </div>
            </Toast.Content>
            <Toast.Close
              aria-label="Dismiss notification"
              className="absolute top-2 right-2 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <XIcon className="size-4" />
            </Toast.Close>
          </Toast.Root>
        ))}
      </Toast.Viewport>
    </Toast.Portal>
  );
}
