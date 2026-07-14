import type { ChatChannelId, ShowId } from "@showtime/contracts";

export interface ChatOpenRequest {
  readonly showId: ShowId;
  readonly channelId: ChatChannelId;
}

export const makeChatNavigation = ({
  getActiveShowId,
  navigateToShow,
  publishOpenRequest,
}: {
  readonly getActiveShowId: () => string | undefined;
  readonly navigateToShow: (showId: ShowId) => Promise<unknown>;
  readonly publishOpenRequest: () => void;
}) => {
  let pendingRequest: ChatOpenRequest | undefined;
  let latestRequestId = 0;

  const open = async (request: ChatOpenRequest) => {
    const requestId = ++latestRequestId;
    pendingRequest = undefined;

    if (getActiveShowId() !== request.showId) {
      await navigateToShow(request.showId);
    }

    if (requestId !== latestRequestId || getActiveShowId() !== request.showId) return;
    pendingRequest = request;
    publishOpenRequest();
  };

  const consume = (showId: ShowId) => {
    if (pendingRequest?.showId !== showId) return undefined;
    const request = pendingRequest;
    pendingRequest = undefined;
    return request;
  };

  return { open, consume } as const;
};
