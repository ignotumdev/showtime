import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { makeConnectionState } from "./connection-state";

afterEach(() => vi.useRealTimers());

describe("connection state", () => {
  it("moves from connecting to disconnected after the retry grace period", () => {
    vi.useFakeTimers();
    const state = makeConnectionState(1_000);

    state.disconnected();
    vi.advanceTimersByTime(500);
    state.disconnected();
    expect(state.getSnapshot()).toEqual({ status: "connecting", generation: 0 });
    vi.advanceTimersByTime(500);
    expect(state.getSnapshot()).toEqual({ status: "disconnected", generation: 1 });
  });

  it("uses reconnecting after a live session and starts a fresh generation for retry", () => {
    vi.useFakeTimers();
    const state = makeConnectionState(1_000);
    const listener = vi.fn();
    state.subscribe(listener);

    state.connected();
    expect(state.getSnapshot()).toEqual({ status: "connected", generation: 0 });
    state.disconnected();
    expect(state.getSnapshot()).toEqual({ status: "reconnecting", generation: 0 });
    vi.advanceTimersByTime(1_000);
    expect(state.getSnapshot()).toEqual({ status: "disconnected", generation: 1 });
    state.connected();

    expect(state.getSnapshot()).toEqual({ status: "connected", generation: 1 });
    expect(listener).toHaveBeenCalledTimes(4);
  });
});
