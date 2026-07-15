import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { showtimeConnectionStorageKey } from "@showtime/shared";
import { getConnectionManagementClient } from "./connection-management";

const credentials = {
  version: 1,
  clientId: "Abcdefghijklmnopqrstu",
  capability: "a".repeat(43),
  clientProfile: "profile_0000000000000000",
  scopes: ["connections:read", "connections:create", "connections:delete"],
};

afterEach(() => vi.unstubAllGlobals());

describe("browser connection management", () => {
  it("exposes a read-only client when the read scope is present", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) =>
          key === showtimeConnectionStorageKey
            ? JSON.stringify({ ...credentials, scopes: ["connections:read"] })
            : null,
      },
    });
    expect(getConnectionManagementClient()).toMatchObject({
      isOwner: false,
      canCreate: false,
      canDelete: false,
    });
  });

  it("sends every operation through the authenticated scoped endpoint", async () => {
    vi.stubGlobal("window", {
      localStorage: { getItem: () => JSON.stringify(credentials) },
    });
    const state = { enabled: true, clients: [] };
    const request = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(state), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    vi.stubGlobal("fetch", request);
    const client = getConnectionManagementClient()!;
    const base = `/connection-management/${credentials.clientId}/${credentials.capability}`;

    await expect(client.connectionsState()).resolves.toEqual(state);
    await expect(
      client.createInvitation("Monitor iPad", credentials.clientProfile, ["connections:read"]),
    ).resolves.toEqual(state);
    await expect(client.removeConnection("connection-id")).resolves.toEqual(state);

    expect(request).toHaveBeenNthCalledWith(1, base, { cache: "no-store" });
    expect(request).toHaveBeenNthCalledWith(2, base, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Monitor iPad",
        clientProfile: credentials.clientProfile,
        scopes: ["connections:read"],
      }),
    });
    expect(request).toHaveBeenNthCalledWith(3, `${base}/connection-id`, {
      method: "DELETE",
    });
  });
});
