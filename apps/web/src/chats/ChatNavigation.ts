import type { ShowId } from "@showtime/contracts";
import { makeChatNavigation, type ChatOpenRequest } from "./ChatNavigationState";

export type { ChatOpenRequest } from "./ChatNavigationState";

const eventName = "showtime-chat-open";

let chatNavigation: ReturnType<typeof makeChatNavigation> | undefined;

export const configureChatNavigation = (options: {
  readonly getActiveShowId: () => string | undefined;
  readonly navigateToShow: (showId: ShowId) => Promise<unknown>;
}) => {
  chatNavigation = makeChatNavigation({
    ...options,
    publishOpenRequest: () => window.dispatchEvent(new Event(eventName)),
  });
};

export const openChat = (request: ChatOpenRequest) => {
  if (!chatNavigation) throw new Error("Chat navigation has not been configured");
  return chatNavigation.open(request);
};

export const consumeChatOpenRequest = (showId: ShowId) => chatNavigation?.consume(showId);

export const subscribeChatOpenRequests = (listener: () => void) => {
  window.addEventListener(eventName, listener);
  return () => window.removeEventListener(eventName, listener);
};
