import * as React from "react";
import type { ShowId } from "@showtime/contracts";

const storageKey = (showId: ShowId) => `showtime.live.startedAt.${showId}`;

export type LiveSessionStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const rendererStorage = (): LiveSessionStorage | undefined => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

export function getOrStartLiveSession(
  showId: ShowId,
  now = Date.now(),
  storage = rendererStorage(),
): number {
  if (!storage) return now;
  try {
    const stored = Number(storage.getItem(storageKey(showId)));
    if (Number.isFinite(stored) && stored > 0 && stored <= now) return stored;
    storage.setItem(storageKey(showId), String(now));
  } catch {
    // A blocked or full storage area must never prevent Live from opening.
  }
  return now;
}

export function endLiveSession(showId: ShowId, storage = rendererStorage()): void {
  try {
    storage?.removeItem(storageKey(showId));
  } catch {
    // Leaving Live must still work when storage is unavailable.
  }
}

export function formatLiveElapsed(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1_000));
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainingSeconds = seconds % 60;
  const minuteSeconds = `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`
    : minuteSeconds;
}

export function useLiveElapsed(showId: ShowId): string {
  const [session, setSession] = React.useState<{
    readonly showId: ShowId;
    readonly startedAt: number;
  }>();
  const [now, setNow] = React.useState(Date.now);

  React.useEffect(() => {
    const committedAt = Date.now();
    setSession({
      showId,
      startedAt: getOrStartLiveSession(showId, committedAt),
    });
    setNow(committedAt);
  }, [showId]);

  React.useEffect(() => {
    let interval: number | undefined;
    const update = () => setNow(Date.now());
    const syncInterval = () => {
      if (interval !== undefined) window.clearInterval(interval);
      interval = undefined;
      update();
      if (!document.hidden) interval = window.setInterval(update, 1_000);
    };

    document.addEventListener("visibilitychange", syncInterval);
    syncInterval();
    return () => {
      document.removeEventListener("visibilitychange", syncInterval);
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, []);

  const startedAt = session?.showId === showId ? session.startedAt : undefined;
  return formatLiveElapsed(startedAt === undefined ? 0 : now - startedAt);
}
