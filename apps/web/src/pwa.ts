import { isDesktopHost } from "./platform";
import { readStoredConnection } from "./connection";
import { showtimeConnectionStorageKey, type ShowtimeStoredConnection } from "@showtime/shared";

const connectionHandoffCookie = "showtime.pwa.connection.v1";
const connectionHandoffLifetimeSeconds = 10 * 60;

type CookieDocument = Pick<Document, "cookie">;
type ConnectionStorage = Pick<Storage, "getItem" | "setItem">;

const browserLocalStorage = (): Storage | undefined => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

export const isStandalonePwa = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone);

const expireConnectionHandoff = (cookieDocument: CookieDocument) => {
  cookieDocument.cookie = `${connectionHandoffCookie}=; Path=/; Max-Age=0; SameSite=Strict`;
};

/**
 * Apple copies cookies, but not localStorage, into a newly installed Home Screen app.
 * Keep this bridge short-lived and only create it immediately before installation.
 */
export const stagePwaConnectionHandoff = (
  cookieDocument: CookieDocument = document,
  connection: ShowtimeStoredConnection | undefined = readStoredConnection(),
): boolean => {
  if (!connection) return false;
  try {
    const value = encodeURIComponent(JSON.stringify(connection));
    cookieDocument.cookie = `${connectionHandoffCookie}=${value}; Path=/; Max-Age=${connectionHandoffLifetimeSeconds}; SameSite=Strict`;
    return cookieDocument.cookie
      .split(";")
      .some((cookie) => cookie.trim().startsWith(`${connectionHandoffCookie}=`));
  } catch {
    return false;
  }
};

export type PwaConnectionHandoffResult = "none" | "restored" | "failed";

export const restorePwaConnectionHandoff = (
  standalone = isStandalonePwa(),
  cookieDocument: CookieDocument = document,
  storage: ConnectionStorage | undefined = browserLocalStorage(),
): PwaConnectionHandoffResult => {
  if (!standalone) return "none";
  const prefix = `${connectionHandoffCookie}=`;
  const cookie = cookieDocument.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix));
  if (!cookie) return "none";

  let raw: string;
  try {
    raw = decodeURIComponent(cookie.slice(prefix.length));
  } catch {
    expireConnectionHandoff(cookieDocument);
    return "failed";
  }

  const connection = readStoredConnection({
    getItem: () => raw,
  });
  if (!connection || !storage) {
    expireConnectionHandoff(cookieDocument);
    return "failed";
  }

  try {
    storage.setItem(showtimeConnectionStorageKey, JSON.stringify(connection));
    if (!readStoredConnection(storage)) return "failed";
    expireConnectionHandoff(cookieDocument);
    return "restored";
  } catch {
    return "failed";
  }
};

const localDevelopmentHost = (hostname: string) =>
  hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";

export const registerServiceWorker = async () => {
  if (
    isDesktopHost() ||
    !("serviceWorker" in navigator) ||
    (location.protocol !== "https:" && !localDevelopmentHost(location.hostname))
  )
    return;

  const manifestUrl = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.href;
  if (!manifestUrl) return;

  try {
    const serviceWorkerUrl = new URL("service-worker.js", manifestUrl);
    await navigator.serviceWorker.register(serviceWorkerUrl, {
      scope: new URL("./", manifestUrl).pathname,
    });
  } catch (error) {
    // PWA support must never interfere with the live-show application.
    console.warn("Showtime could not register its offline app shell.", error);
  }
};
