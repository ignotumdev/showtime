import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { makeConnectionState } from "./connection-state";

afterEach(() => vi.useRealTimers());

describe("connection state", () => {
  it("tracks transport readiness separately from initial synchronization", () => {
    const state = makeConnectionState();

    state.transportConnected(0);
    expect(state.getSnapshot().status).toBe("connecting");
    state.synchronized(0);
    expect(state.getSnapshot().status).toBe("connected");
  });

  it("refreshes subscriptions when Effect reopens an established transport", () => {
    const state = makeConnectionState();
    state.transportConnected(0);
    state.synchronized(0);
    state.transportDisconnected(0);
    expect(state.getSnapshot()).toMatchObject({
      status: "reconnecting",
      subscriptionGeneration: 0,
    });

    state.transportConnected(0);
    expect(state.getSnapshot()).toMatchObject({
      status: "reconnecting",
      subscriptionGeneration: 1,
    });
    state.synchronized(0);
    expect(state.getSnapshot().status).toBe("connected");
  });

  it("marks a prolonged failure unavailable without stopping automatic retries", () => {
    vi.useFakeTimers();
    const state = makeConnectionState(1_000);

    state.transportDisconnected(0);
    vi.advanceTimersByTime(1_000);
    expect(state.getSnapshot().status).toBe("disconnected");
    state.transportConnected(0);
    expect(state.getSnapshot().status).toBe("connecting");
  });

  it("starts a fresh attempt immediately and ignores stale runtime callbacks", () => {
    const state = makeConnectionState();
    state.transportConnected(0);
    state.synchronized(0);

    state.retryNow();
    expect(state.getSnapshot()).toMatchObject({ status: "reconnecting", attempt: 1 });
    state.transportDisconnected(0);
    state.transportConnected(0);
    state.synchronized(0);
    expect(state.getSnapshot()).toMatchObject({ status: "reconnecting", attempt: 1 });

    state.transportConnected(1);
    state.synchronized(1);
    expect(state.getSnapshot()).toMatchObject({ status: "connected", attempt: 1 });
  });

  it("classifies disabled and revoked credentials for the current attempt", () => {
    const state = makeConnectionState();
    state.classified(0, "disabled");
    expect(state.getSnapshot().status).toBe("disabled");
    state.classified(0, "revoked");
    expect(state.getSnapshot().status).toBe("revoked");
    state.retryNow();
    state.classified(0, "revoked");
    expect(state.getSnapshot()).toMatchObject({ status: "connecting", attempt: 1 });
  });
});
