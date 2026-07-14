import type { ShowtimeConnectionCandidate, ShowtimeLocalDiscoveryState } from "@showtime/shared";

const pairingInfoPollInterval = 750;
const pairingInfoMaxErrorRetryInterval = 5_000;

export const selectPairingCandidateUrl = (
  candidates: ReadonlyArray<ShowtimeConnectionCandidate>,
  currentUrl: string,
) =>
  candidates.some((candidate) => candidate.url === currentUrl)
    ? currentUrl
    : (candidates[0]?.url ?? "");

export const shouldPollPairingInfo = (discovery: ShowtimeLocalDiscoveryState) =>
  discovery.kind === "probing" || discovery.kind === "degraded";

export const pairingInfoRetryDelay = (consecutiveFailures: number) =>
  Math.min(
    pairingInfoMaxErrorRetryInterval,
    pairingInfoPollInterval * 2 ** Math.max(0, consecutiveFailures - 1),
  );

export const pairingInfoRetryWait = (
  expiresAt: number,
  requestedDelay: number,
  now = Date.now(),
) => {
  const remaining = expiresAt - now;
  return Number.isFinite(remaining) && remaining > 0
    ? Math.min(requestedDelay, remaining)
    : undefined;
};

export const canLoadPairingInfo = (
  hasRequestedPairingInfo: boolean,
  expiresAt: number,
  now = Date.now(),
) => !hasRequestedPairingInfo || pairingInfoRetryWait(expiresAt, 0, now) !== undefined;

export const pairingCandidateCaption = (candidate: ShowtimeConnectionCandidate) =>
  candidate.kind === "ip-address" ? candidate.label : `${candidate.label} · ${candidate.host}`;

export const pairingInfoPollDelay = pairingInfoPollInterval;
