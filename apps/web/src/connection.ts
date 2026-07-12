import { showtimeConnectionStorageKey, type ShowtimeStoredConnection } from "@showtime/shared";

const capabilityPattern = /^[A-Za-z0-9_-]{43}$/;
const clientIdPattern = /^[A-Za-z0-9_-]{21}$/;
const pairingTokenPattern = /^[A-Za-z0-9_-]{43}$/;
const fragmentPrefix = "#pair=";

export type PairingResult =
  | { readonly status: "none" }
  | { readonly status: "paired" }
  | { readonly status: "failed"; readonly message: string };

export const readStoredConnection = (
  storage: Pick<Storage, "getItem"> = window.localStorage,
): ShowtimeStoredConnection | undefined => {
  try {
    const raw = storage.getItem(showtimeConnectionStorageKey);
    if (raw === null) return undefined;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "version" in parsed &&
      parsed.version === 1 &&
      "clientId" in parsed &&
      typeof parsed.clientId === "string" &&
      clientIdPattern.test(parsed.clientId) &&
      "capability" in parsed &&
      typeof parsed.capability === "string" &&
      capabilityPattern.test(parsed.capability)
    ) {
      return parsed as ShowtimeStoredConnection;
    }
  } catch {
    // Storage can be unavailable in privacy modes. Treat it as unpaired.
  }
  return undefined;
};

export const capturePairingFragment = async (
  location: Pick<Location, "hash" | "pathname" | "search"> = window.location,
  storage: Pick<Storage, "setItem"> = window.localStorage,
  history: Pick<History, "replaceState"> = window.history,
  request: typeof fetch = fetch,
): Promise<PairingResult> => {
  if (!location.hash.startsWith(fragmentPrefix)) return { status: "none" };
  const token = location.hash.slice(fragmentPrefix.length);
  history.replaceState(null, "", `${location.pathname}${location.search}#/`);
  if (!pairingTokenPattern.test(token)) {
    return { status: "failed", message: "This connection link is invalid." };
  }
  try {
    const response = await request(`/pair/${token}`, { method: "POST" });
    if (!response.ok) {
      return {
        status: "failed",
        message:
          response.status === 410
            ? "This connection link has expired or has already been used. Ask the engineer for a new link."
            : "Showtime could not complete the connection. Ask the engineer to check connections.",
      };
    }
    const parsed: unknown = await response.json();
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("version" in parsed) ||
      parsed.version !== 1 ||
      !("clientId" in parsed) ||
      typeof parsed.clientId !== "string" ||
      !clientIdPattern.test(parsed.clientId) ||
      !("capability" in parsed) ||
      typeof parsed.capability !== "string" ||
      !capabilityPattern.test(parsed.capability)
    ) {
      return { status: "failed", message: "Showtime returned invalid connection details." };
    }
    storage.setItem(showtimeConnectionStorageKey, JSON.stringify(parsed));
    return { status: "paired" };
  } catch {
    return {
      status: "failed",
      message: "This device could not reach Showtime. Check the network and try again.",
    };
  }
};

export const storedRpcWebSocketUrl = (
  location: Pick<Location, "protocol" | "host">,
  connection: ShowtimeStoredConnection,
) => {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${location.host}/rpc/${connection.clientId}/${connection.capability}`;
};

export const hasBrowserConnection = () => readStoredConnection() !== undefined;

export const forgetBrowserConnection = (
  storage: Pick<Storage, "removeItem"> = window.localStorage,
) => {
  storage.removeItem(showtimeConnectionStorageKey);
};
