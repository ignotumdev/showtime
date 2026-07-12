import { describe, expect, it, vi } from "vite-plus/test";
import { showtimeConnectionStorageKey } from "@showtime/shared";
import { capturePairingFragment, readStoredConnection, storedRpcWebSocketUrl } from "./connection";

const capability = "a".repeat(43);
const clientId = "Abcdefghijklmnopqrstu";
const pairingToken = "p".repeat(43);

describe("browser connection persistence", () => {
  it("exchanges a valid single-use pairing fragment and removes it from history", async () => {
    const setItem = vi.fn();
    const replaceState = vi.fn();
    const request = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ version: 1, clientId, capability }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    await expect(
      capturePairingFragment(
        { hash: `#pair=${pairingToken}`, pathname: "/", search: "" },
        { setItem },
        { replaceState },
        request,
      ),
    ).resolves.toEqual({ status: "paired" });
    expect(request).toHaveBeenCalledWith(`/pair/${pairingToken}`, { method: "POST" });
    expect(setItem).toHaveBeenCalledWith(
      showtimeConnectionStorageKey,
      JSON.stringify({ version: 1, clientId, capability }),
    );
    expect(replaceState).toHaveBeenCalledWith(null, "", "/#/");
  });

  it("rejects malformed pairing tokens", async () => {
    const setItem = vi.fn();
    await expect(
      capturePairingFragment(
        { hash: "#pair=short", pathname: "/", search: "" },
        { setItem },
        { replaceState: vi.fn() },
      ),
    ).resolves.toMatchObject({ status: "failed" });
    expect(setItem).not.toHaveBeenCalled();
  });

  it("restores a validated record and creates its authenticated socket URL", () => {
    const connection = readStoredConnection({
      getItem: () => JSON.stringify({ version: 1, clientId, capability }),
    });
    expect(connection).toEqual({ version: 1, clientId, capability });
    expect(
      storedRpcWebSocketUrl({ protocol: "http:", host: "192.168.1.2:34987" }, connection!),
    ).toBe(`ws://192.168.1.2:34987/rpc/${clientId}/${capability}`);
  });
});
