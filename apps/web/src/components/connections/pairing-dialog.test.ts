import { describe, expect, it } from "vite-plus/test";
import type { ShowtimeConnectionCandidate } from "@showtime/shared";
import {
  canLoadPairingInfo,
  pairingInfoRetryDelay,
  pairingInfoRetryWait,
  selectPairingCandidateUrl,
  shouldPollPairingInfo,
} from "./pairing-dialog";

const ipCandidate = (url: string, label = "wifi — 192.168.1.20"): ShowtimeConnectionCandidate => ({
  kind: "ip-address",
  label,
  host: "192.168.1.20",
  interfaceName: "wifi",
  url,
});

describe("pairing dialog", () => {
  it("preserves the selected fallback while it remains a candidate", () => {
    const candidates = [ipCandidate("http://first"), ipCandidate("http://selected")];

    expect(selectPairingCandidateUrl(candidates, "http://selected")).toBe("http://selected");
    expect(selectPairingCandidateUrl(candidates, "http://missing")).toBe("http://first");
    expect(selectPairingCandidateUrl([], "http://selected")).toBe("");
  });

  it("polls every discovery state that can recover", () => {
    expect(shouldPollPairingInfo({ kind: "probing" })).toBe(true);
    expect(shouldPollPairingInfo({ kind: "degraded", reason: "network-unavailable" })).toBe(true);
    expect(shouldPollPairingInfo({ kind: "announced", hostname: "showtime.local" })).toBe(false);
    expect(shouldPollPairingInfo({ kind: "disabled" })).toBe(false);
  });

  it("bounds repeated pairing-info failure retries", () => {
    expect(pairingInfoRetryDelay(1)).toBe(750);
    expect(pairingInfoRetryDelay(2)).toBe(1_500);
    expect(pairingInfoRetryDelay(10)).toBe(5_000);
  });

  it("stops retries at invitation expiry", () => {
    expect(pairingInfoRetryWait(10_000, 750, 1_000)).toBe(750);
    expect(pairingInfoRetryWait(1_500, 750, 1_000)).toBe(500);
    expect(pairingInfoRetryWait(1_000, 750, 1_000)).toBeUndefined();
    expect(pairingInfoRetryWait(Number.NaN, 750, 1_000)).toBeUndefined();
  });

  it("allows the first pairing-info request to renew an expired invitation", () => {
    expect(canLoadPairingInfo(false, 1_000, 1_000)).toBe(true);
    expect(canLoadPairingInfo(true, 1_000, 1_000)).toBe(false);
  });
});
