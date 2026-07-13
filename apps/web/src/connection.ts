import { showtimeConnectionStorageKey, type ShowtimeStoredConnection } from "@showtime/shared";

const capabilityPattern = /^[A-Za-z0-9_-]{43}$/;
const clientIdPattern = /^[A-Za-z0-9_-]{21}$/;
const pairingTokenPattern = /^[A-Za-z0-9_-]{43}$/;
const fragmentPrefix = "#pair=";

export type PairingResult =
  | { readonly status: "none" }
  | { readonly status: "paired" }
  | { readonly status: "failed"; readonly message: string };

type ReadableStorage = Pick<Storage, "getItem">;
type WritableStorage = Pick<Storage, "setItem" | "removeItem">;

export type ForgetConnectionResult =
  | { readonly status: "forgotten" }
  | { readonly status: "failed"; readonly message: string };

export type ConnectionProbeResult = "available" | "disabled" | "revoked" | "unreachable";

export const connectionStorageChangedEvent = "showtime:connection-storage-changed";

const browserLocalStorage = (): Storage | undefined => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

export const readStoredConnection = (
  storage: ReadableStorage | undefined = browserLocalStorage(),
): ShowtimeStoredConnection | undefined => {
  try {
    if (!storage) return undefined;
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
  storage: WritableStorage | undefined = browserLocalStorage(),
  history: Pick<History, "replaceState"> = window.history,
  request: typeof fetch = fetch,
): Promise<PairingResult> => {
  if (!location.hash.startsWith(fragmentPrefix)) return { status: "none" };
  const token = location.hash.slice(fragmentPrefix.length);
  const removePairingFragment = () =>
    history.replaceState(null, "", `${location.pathname}${location.search}#/`);
  if (!pairingTokenPattern.test(token)) {
    removePairingFragment();
    return { status: "failed", message: "This connection link is invalid." };
  }

  if (!storage) {
    return {
      status: "failed",
      message:
        "This browser cannot save the connection. Enable site storage and try the link again.",
    };
  }

  // Invitations are single-use. Reserve enough storage for the fixed-size
  // credentials before asking the server to consume one.
  const probeKey = `${showtimeConnectionStorageKey}.probe`;
  try {
    storage.setItem(
      probeKey,
      JSON.stringify({ version: 1, clientId: "c".repeat(21), capability: "c".repeat(43) }),
    );
  } catch {
    return {
      status: "failed",
      message:
        "This browser cannot save the connection. Free up site storage and try the link again.",
    };
  }

  const releaseReservation = () => {
    try {
      storage.removeItem(probeKey);
    } catch {
      // A later operation reports the actionable failure.
    }
  };

  let response: Response;
  try {
    response = await request(`/pair/${token}`, { method: "POST" });
  } catch {
    releaseReservation();
    return {
      status: "failed",
      message: "This device could not reach Showtime. Check the network and try again.",
    };
  }
  if (!response.ok) {
    releaseReservation();
    if (response.status === 410) removePairingFragment();
    return {
      status: "failed",
      message:
        response.status === 410
          ? "This connection link has expired or has already been used. Ask the engineer for a new link."
          : "Showtime could not complete the connection. Ask the engineer to check connections.",
    };
  }

  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    releaseReservation();
    removePairingFragment();
    return { status: "failed", message: "Showtime returned invalid connection details." };
  }
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
    releaseReservation();
    removePairingFragment();
    return { status: "failed", message: "Showtime returned invalid connection details." };
  }

  releaseReservation();
  try {
    storage.setItem(showtimeConnectionStorageKey, JSON.stringify(parsed));
  } catch {
    removePairingFragment();
    return {
      status: "failed",
      message:
        "This browser could not save the connection after the link was used. Ask the engineer for a new link.",
    };
  }
  removePairingFragment();
  return { status: "paired" };
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
  storage: Pick<Storage, "getItem" | "removeItem"> | undefined = browserLocalStorage(),
): ForgetConnectionResult => {
  if (!storage) {
    return {
      status: "failed",
      message: "This browser cannot access the saved connection.",
    };
  }
  try {
    storage.removeItem(showtimeConnectionStorageKey);
    if (storage.getItem(showtimeConnectionStorageKey) !== null) {
      return {
        status: "failed",
        message: "This browser did not remove the saved connection. Check site storage settings.",
      };
    }
    if (typeof window !== "undefined")
      window.dispatchEvent(new Event(connectionStorageChangedEvent));
    return { status: "forgotten" };
  } catch {
    return {
      status: "failed",
      message: "This browser could not remove the saved connection. Check site storage settings.",
    };
  }
};

export const probeStoredConnection = async (
  connection: ShowtimeStoredConnection,
  request: typeof fetch = fetch,
): Promise<ConnectionProbeResult> => {
  try {
    const response = await request(
      `/connection-status/${connection.clientId}/${connection.capability}`,
      { cache: "no-store" },
    );
    if (response.status === 200) return "available";
    if (response.status === 503) return "disabled";
    if (response.status === 401) return "revoked";
    return "unreachable";
  } catch {
    return "unreachable";
  }
};
