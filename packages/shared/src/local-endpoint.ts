import { Schema } from "effect";

export const showtimeLocalPort = 8585;
export const showtimeLocalBaseLabel = "showtime";

const hostnameLabelPattern = /^showtime(?:-[1-9]\d*)?$/;

export const ShowtimeHostnameLabel = Schema.String.check(
  Schema.isPattern(hostnameLabelPattern, { expected: "a Showtime .local hostname label" }),
  Schema.isMaxLength(63),
);
export type ShowtimeHostnameLabel = typeof ShowtimeHostnameLabel.Type;

export const parseShowtimeHostnameSuffix = (label: string): number | undefined => {
  if (label === showtimeLocalBaseLabel) return 0;
  const match = /^showtime-([1-9]\d*)$/.exec(label);
  if (!match) return undefined;
  const suffix = Number(match[1]);
  return Number.isSafeInteger(suffix) ? suffix : undefined;
};

export const formatShowtimeHostnameLabel = (suffix: number): ShowtimeHostnameLabel => {
  if (!Number.isSafeInteger(suffix) || suffix < 0)
    throw new RangeError("The Showtime hostname suffix must be a non-negative safe integer");
  const label = suffix === 0 ? showtimeLocalBaseLabel : `${showtimeLocalBaseLabel}-${suffix}`;
  return Schema.decodeUnknownSync(ShowtimeHostnameLabel)(label);
};

export const showtimeLocalHostname = (label: ShowtimeHostnameLabel) => `${label}.local`;

export const showtimePairingUrl = (host: string, pairingToken: string, port = showtimeLocalPort) =>
  `http://${host}:${port}/#pair=${encodeURIComponent(pairingToken)}`;

export const showtimeHostnamePairingUrl = (
  label: ShowtimeHostnameLabel,
  pairingToken: string,
  port = showtimeLocalPort,
) => showtimePairingUrl(showtimeLocalHostname(label), pairingToken, port);
