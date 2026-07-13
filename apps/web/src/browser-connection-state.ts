import * as React from "react";
import { showtimeConnectionStorageKey } from "@showtime/shared";
import { connectionStorageChangedEvent, readStoredConnection } from "./connection";

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

const browserConnectionIdentity = () => {
  const connection = readStoredConnection();
  return connection === undefined ? undefined : `${connection.clientId}:${connection.capability}`;
};

export const useBrowserConnectionIdentity = () =>
  React.useSyncExternalStore(subscribe, browserConnectionIdentity, () => undefined);

export const useHasBrowserConnection = () => useBrowserConnectionIdentity() !== undefined;
