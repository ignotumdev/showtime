import type { ChatChannelId, ShowId } from "@showtime/contracts";
import { router } from "@/router";

export interface ChatOpenRequest {
  readonly showId: ShowId;
  readonly channelId: ChatChannelId;
}

const eventName = "showtime-chat-open";
let pendingRequest: ChatOpenRequest | undefined;

const activeShowId = () => {
  for (const match of router.state.matches) {
    const showId = (match.params as { readonly showId?: unknown }).showId;
    if (typeof showId === "string") return showId;
  }
  return undefined;
};

export const openChat = async (request: ChatOpenRequest) => {
  if (activeShowId() !== request.showId) {
    await router.navigate({ to: "/shows/$showId", params: { showId: request.showId } });
  }
  pendingRequest = request;
  window.dispatchEvent(new Event(eventName));
};

export const consumeChatOpenRequest = (showId: ShowId) => {
  if (pendingRequest?.showId !== showId) return undefined;
  const request = pendingRequest;
  pendingRequest = undefined;
  return request;
};

export const subscribeChatOpenRequests = (listener: () => void) => {
  window.addEventListener(eventName, listener);
  return () => window.removeEventListener(eventName, listener);
};
