import * as React from "react";

export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

export interface ConnectionSnapshot {
  readonly status: ConnectionStatus;
  /** Changes for each retry so every streaming RPC subscription is recreated. */
  readonly generation: number;
}

export const makeConnectionState = (disconnectedDelayMs = 5_000) => {
  const listeners = new Set<() => void>();
  let snapshot: ConnectionSnapshot = { status: "connecting", generation: 0 };
  let hasConnected = false;
  let disconnectedTimer: ReturnType<typeof setTimeout> | undefined;

  const emit = (next: ConnectionSnapshot) => {
    snapshot = next;
    for (const listener of listeners) listener();
  };

  const clearDisconnectedTimer = () => {
    if (disconnectedTimer !== undefined) clearTimeout(disconnectedTimer);
    disconnectedTimer = undefined;
  };

  return {
    connected() {
      clearDisconnectedTimer();
      hasConnected = true;
      if (snapshot.status !== "connected") emit({ ...snapshot, status: "connected" });
    },
    disconnected() {
      if (disconnectedTimer !== undefined) return;
      if (snapshot.status !== "disconnected") {
        emit({ ...snapshot, status: hasConnected ? "reconnecting" : "connecting" });
      }
      disconnectedTimer = setTimeout(() => {
        disconnectedTimer = undefined;
        emit({ status: "disconnected", generation: snapshot.generation + 1 });
      }, disconnectedDelayMs);
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      return snapshot;
    },
  };
};

export const connectionState = makeConnectionState();
const subscribeConnectionState = (listener: () => void) => connectionState.subscribe(listener);
const getConnectionSnapshot = () => connectionState.getSnapshot();

export const useConnectionSnapshot = () =>
  React.useSyncExternalStore(
    subscribeConnectionState,
    getConnectionSnapshot,
    getConnectionSnapshot,
  );
