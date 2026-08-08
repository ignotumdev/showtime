import { router } from "@/router";
import { makeChatNavigation } from "./ChatNavigationState";

export type { ChatOpenRequest } from "./ChatNavigationState";

const eventName = "showtime-chat-open";

const activeChatShowId = () => {
  const pathname = router.state.location.pathname;
  if (!pathname.includes("/live/") && !pathname.endsWith("/chat")) return undefined;
  for (const match of router.state.matches) {
    const showId = (match.params as { readonly showId?: unknown }).showId;
    if (typeof showId === "string") return showId;
  }
  return undefined;
};

const chatNavigation = makeChatNavigation({
  getActiveShowId: activeChatShowId,
  navigateToShow: (showId) => router.navigate({ to: "/shows/$showId/chat", params: { showId } }),
  publishOpenRequest: () => window.dispatchEvent(new Event(eventName)),
});

export const openChat = chatNavigation.open;

export const consumeChatOpenRequest = chatNavigation.consume;

export const subscribeChatOpenRequests = (listener: () => void) => {
  window.addEventListener(eventName, listener);
  return () => window.removeEventListener(eventName, listener);
};
