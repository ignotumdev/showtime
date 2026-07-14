import { describe, expect, it, vi } from "vite-plus/test";
import { showtimeConnectionStorageKey } from "@showtime/shared";
import {
  capturePairingFragment,
  forgetBrowserConnection,
  probeStoredConnection,
  readStoredConnection,
  storedRpcWebSocketUrl,
} from "./connection";

const capability = "a".repeat(43);
const clientId = "Abcdefghijklmnopqrstu";
const pairingToken = "p".repeat(43);

describe("browser connection persistence", () => {
  it("exchanges a valid single-use pairing fragment and removes it from history", async () => {
    const setItem = vi.fn();
    const removeItem = vi.fn();
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
        { setItem, removeItem },
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
        { setItem, removeItem: vi.fn() },
        { replaceState: vi.fn() },
      ),
    ).resolves.toMatchObject({ status: "failed" });
    expect(setItem).not.toHaveBeenCalled();
  });

  it("does not consume an invitation when credentials cannot be persisted", async () => {
    const request = vi.fn();
    const replaceState = vi.fn();
    await expect(
      capturePairingFragment(
        { hash: `#pair=${pairingToken}`, pathname: "/", search: "" },
        {
          setItem: () => {
            throw new DOMException("Storage full", "QuotaExceededError");
          },
          removeItem: vi.fn(),
        },
        { replaceState },
        request,
      ),
    ).resolves.toMatchObject({ status: "failed", message: expect.stringContaining("storage") });
    expect(request).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("retains a valid pairing fragment after a transient network failure", async () => {
    const removeItem = vi.fn();
    const replaceState = vi.fn();
    await expect(
      capturePairingFragment(
        { hash: `#pair=${pairingToken}`, pathname: "/", search: "" },
        { setItem: vi.fn(), removeItem },
        { replaceState },
        vi.fn().mockRejectedValue(new TypeError("Network error")),
      ),
    ).resolves.toMatchObject({ status: "failed" });
    expect(removeItem).toHaveBeenCalledWith(`${showtimeConnectionStorageKey}.probe`);
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("removes a consumed pairing fragment when saving the exchanged credentials fails", async () => {
    const replaceState = vi.fn();
    const setItem = vi.fn((key: string) => {
      if (key === showtimeConnectionStorageKey) {
        throw new DOMException("Storage unavailable", "SecurityError");
      }
    });
    const request = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ version: 1, clientId, capability }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(
      capturePairingFragment(
        { hash: `#pair=${pairingToken}`, pathname: "/", search: "" },
        { setItem, removeItem: vi.fn() },
        { replaceState },
        request,
      ),
    ).resolves.toEqual({
      status: "failed",
      message:
        "This browser could not save the connection after the link was used. Ask the engineer for a new link.",
    });
    expect(request).toHaveBeenCalledOnce();
    expect(replaceState).toHaveBeenCalledWith(null, "", "/#/");
  });

  it("restores a validated record and creates its authenticated socket URL", () => {
    const connection = readStoredConnection({
      getItem: () => JSON.stringify({ version: 1, clientId, capability }),
    });
    expect(connection).toEqual({ version: 1, clientId, capability });
    expect(
      storedRpcWebSocketUrl({ protocol: "http:", host: "showtime.local:8585" }, connection!),
    ).toBe(`ws://showtime.local:8585/rpc/${clientId}/${capability}`);
  });

  it("verifies that forgetting removed the credentials", () => {
    let stored: string | null = "credentials";
    expect(
      forgetBrowserConnection({
        getItem: () => stored,
        removeItem: () => {
          stored = null;
        },
      }),
    ).toEqual({ status: "forgotten" });
  });

  it("reports storage failures instead of preventing the recovery action", () => {
    expect(
      forgetBrowserConnection({
        getItem: () => "credentials",
        removeItem: () => {
          throw new DOMException("Blocked", "SecurityError");
        },
      }),
    ).toMatchObject({ status: "failed", message: expect.stringContaining("could not remove") });
  });

  it.each([
    [200, "available"],
    [503, "disabled"],
    [401, "revoked"],
  ] as const)("maps connection probe status %s to %s", async (status, expected) => {
    const request = vi.fn().mockResolvedValue(new Response(null, { status }));
    await expect(
      probeStoredConnection({ version: 1, clientId, capability }, request),
    ).resolves.toBe(expected);
    expect(request).toHaveBeenCalledWith(`/connection-status/${clientId}/${capability}`, {
      cache: "no-store",
      signal: expect.any(AbortSignal),
    });
  });

  it("bounds stalled connection probes so recovery can continue", async () => {
    vi.useFakeTimers();
    try {
      const request = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        expect(init?.signal).toBeInstanceOf(AbortSignal);
        return new Promise<Response>(() => undefined);
      });
      const result = probeStoredConnection(
        { version: 1, clientId, capability },
        request as typeof fetch,
        1_000,
      );

      await vi.advanceTimersByTimeAsync(1_000);
      await expect(result).resolves.toBe("unreachable");
      expect(request).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });
});
