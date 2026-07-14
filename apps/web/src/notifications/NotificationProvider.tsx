import * as React from "react";
import { Toast } from "@base-ui/react/toast";
import { XIcon } from "lucide-react";
import { notificationManager, type AppNotification } from "./NotificationCenter";

export function NotificationProvider({ children }: { readonly children: React.ReactNode }) {
  return (
    <Toast.Provider limit={5} timeout={6_000} toastManager={notificationManager}>
      {children}
      <NotificationViewport />
    </Toast.Provider>
  );
}

function NotificationViewport() {
  const { toasts } = Toast.useToastManager<AppNotification>();
  return (
    <Toast.Portal>
      <Toast.Viewport className="fixed right-3 bottom-3 z-[100] flex w-[min(24rem,calc(100vw-1.5rem))] flex-col-reverse gap-2 outline-none sm:right-4 sm:bottom-4">
        {toasts.map((toast) => (
          <Toast.Root
            key={toast.id}
            toast={toast}
            swipeDirection="right"
            className="relative rounded-lg border bg-popover p-4 pr-10 text-popover-foreground shadow-lg transition data-ending-style:translate-x-full data-ending-style:opacity-0 data-starting-style:translate-y-2 data-starting-style:opacity-0"
          >
            <Toast.Content>
              <Toast.Title className="text-sm font-semibold">{toast.title}</Toast.Title>
              {toast.description && (
                <Toast.Description className="mt-1 line-clamp-3 text-sm text-muted-foreground">
                  {toast.description}
                </Toast.Description>
              )}
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
