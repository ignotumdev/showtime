import * as React from "react";
import { showtimeConnectionStorageKey } from "@showtime/shared";
import { connectionStorageChangedEvent, hasBrowserConnection } from "./connection";

const subscribe = (listener: () => void) => {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === showtimeConnectionStorageKey) listener();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(connectionStorageChangedEvent, listener);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(connectionStorageChangedEvent, listener);
  };
};

export const useHasBrowserConnection = () =>
  React.useSyncExternalStore(subscribe, hasBrowserConnection, () => false);
