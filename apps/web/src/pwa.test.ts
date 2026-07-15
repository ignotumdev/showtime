import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { showtimeConnectionStorageKey } from "@showtime/shared";
import { restorePwaConnectionHandoff, stagePwaConnectionHandoff } from "./pwa";

const connection = {
  version: 1 as const,
  clientId: "Abcdefghijklmnopqrstu",
  capability: "a".repeat(43),
  scopes: ["connections:read" as const],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PWA connection handoff", () => {
  it("stages a secure, short-lived validated connection cookie on HTTPS", () => {
    vi.stubGlobal("location", { protocol: "https:" });
    const cookieDocument = { cookie: "" };

    expect(stagePwaConnectionHandoff(cookieDocument, connection)).toBe(true);
    expect(cookieDocument.cookie).toContain("showtime.pwa.connection.v1=");
    expect(cookieDocument.cookie).toContain("Max-Age=600");
    expect(cookieDocument.cookie).toContain("SameSite=Strict");
    expect(cookieDocument.cookie).toContain("Secure");
  });

  it("allows the handoff cookie on an HTTP localhost development origin", () => {
    vi.stubGlobal("location", { protocol: "http:", hostname: "localhost" });
    const cookieDocument = { cookie: "" };

    expect(stagePwaConnectionHandoff(cookieDocument, connection)).toBe(true);
    expect(cookieDocument.cookie).not.toContain("Secure");
  });

  it("restores the handoff only inside an installed app", () => {
    const stagedDocument = { cookie: "" };
    stagePwaConnectionHandoff(stagedDocument, connection);
    const cookie = stagedDocument.cookie.split(";", 1)[0]!;
    const cookieDocument = { cookie };
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    expect(restorePwaConnectionHandoff(false, cookieDocument, storage)).toBe("none");
    expect(values.size).toBe(0);
    expect(restorePwaConnectionHandoff(true, cookieDocument, storage)).toBe("restored");
    expect(JSON.parse(values.get(showtimeConnectionStorageKey)!)).toEqual(connection);
    expect(cookieDocument.cookie).toContain("Max-Age=0");
  });

  it("rejects malformed handoffs without storing them", () => {
    const setItem = vi.fn();
    const cookieDocument = {
      cookie: `showtime.pwa.connection.v1=${encodeURIComponent('{"version":1}')}`,
    };

    expect(
      restorePwaConnectionHandoff(true, cookieDocument, {
        getItem: () => null,
        setItem,
      }),
    ).toBe("failed");
    expect(setItem).not.toHaveBeenCalled();
    expect(cookieDocument.cookie).toContain("Max-Age=0");
  });
});
