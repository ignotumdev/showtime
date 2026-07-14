import { describe, expect, it } from "vite-plus/test";
import type { ChatChannelId, ShowId } from "@showtime/contracts";
import { makeChatNavigation, type ChatOpenRequest } from "./ChatNavigationState";

const request = (show: number, channel: number): ChatOpenRequest => ({
  showId: `show_${show.toString().padStart(16, "0")}` as ShowId,
  channelId: `channel_${channel.toString().padStart(16, "0")}` as ChatChannelId,
});

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
};

describe("chat navigation", () => {
  it("only publishes the latest request when navigations complete out of order", async () => {
    let activeShowId: string | undefined;
    const navigations = new Map<ShowId, ReturnType<typeof deferred>>();
    const published: Array<void> = [];
    const navigation = makeChatNavigation({
      getActiveShowId: () => activeShowId,
      navigateToShow: (showId) => {
        const navigation = deferred();
        navigations.set(showId, navigation);
        return navigation.promise;
      },
      publishOpenRequest: () => published.push(undefined),
    });
    const first = request(1, 1);
    const second = request(2, 2);

    const firstOpen = navigation.open(first);
    const secondOpen = navigation.open(second);
    activeShowId = second.showId;
    navigations.get(second.showId)?.resolve();
    await secondOpen;

    activeShowId = first.showId;
    navigations.get(first.showId)?.resolve();
    await firstOpen;

    expect(published).toHaveLength(1);
    expect(navigation.consume(first.showId)).toBeUndefined();
    activeShowId = second.showId;
    expect(navigation.consume(second.showId)).toEqual(second);
  });

  it("does not publish when navigation completes without activating the requested show", async () => {
    const navigation = makeChatNavigation({
      getActiveShowId: () => undefined,
      navigateToShow: async () => undefined,
      publishOpenRequest: () => {
        throw new Error("unexpected publication");
      },
    });
    const requested = request(1, 1);

    await navigation.open(requested);

    expect(navigation.consume(requested.showId)).toBeUndefined();
  });
});
