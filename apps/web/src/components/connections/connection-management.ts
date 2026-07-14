import type {
  ShowtimeConnectionInfo,
  ShowtimeConnectionScope,
  ShowtimeConnectionsState,
} from "@showtime/shared";
import { hasShowtimeConnectionScope } from "@showtime/shared";
import { readStoredConnection } from "../../connection";

export interface ConnectionManagementClient {
  readonly isOwner: boolean;
  readonly canCreate: boolean;
  readonly canDelete: boolean;
  readonly connectionsState: () => Promise<ShowtimeConnectionsState>;
  readonly createInvitation: (
    name: string | undefined,
    scopes: ReadonlyArray<ShowtimeConnectionScope>,
  ) => Promise<ShowtimeConnectionsState>;
  readonly pairingInfo: (invitationId: string) => Promise<ShowtimeConnectionInfo>;
  readonly removeConnection: (id: string) => Promise<ShowtimeConnectionsState>;
  readonly setConnectionsEnabled?: (enabled: boolean) => Promise<ShowtimeConnectionsState>;
}

const responseJson = async <A>(response: Response): Promise<A> => {
  if (!response.ok) throw new Error(`Connection management failed (${response.status})`);
  return (await response.json()) as A;
};

export const getConnectionManagementClient = (): ConnectionManagementClient | undefined => {
  const bridge = window.showtime;
  if (bridge) {
    return {
      isOwner: true,
      canCreate: true,
      canDelete: true,
      connectionsState: bridge.connectionsState,
      createInvitation: bridge.createInvitation,
      pairingInfo: bridge.pairingInfo,
      removeConnection: bridge.removeConnection,
      setConnectionsEnabled: bridge.setConnectionsEnabled,
    };
  }

  const connection = readStoredConnection();
  if (!connection || !hasShowtimeConnectionScope(connection.scopes, "connections:read")) {
    return undefined;
  }
  const base = `/connection-management/${encodeURIComponent(connection.clientId)}/${encodeURIComponent(connection.capability)}`;
  return {
    isOwner: false,
    canCreate: hasShowtimeConnectionScope(connection.scopes, "connections:create"),
    canDelete: hasShowtimeConnectionScope(connection.scopes, "connections:delete"),
    connectionsState: () =>
      fetch(base, { cache: "no-store" }).then((response) =>
        responseJson<ShowtimeConnectionsState>(response),
      ),
    createInvitation: (name, scopes) =>
      fetch(base, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, scopes }),
      }).then((response) => responseJson<ShowtimeConnectionsState>(response)),
    pairingInfo: (invitationId) =>
      fetch(`${base}/pairing/${encodeURIComponent(invitationId)}`, { cache: "no-store" }).then(
        (response) => responseJson<ShowtimeConnectionInfo>(response),
      ),
    removeConnection: (id) =>
      fetch(`${base}/${encodeURIComponent(id)}`, { method: "DELETE" }).then((response) =>
        responseJson<ShowtimeConnectionsState>(response),
      ),
  };
};
