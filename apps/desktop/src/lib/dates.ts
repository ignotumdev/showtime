const relativeTimeFormatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: "auto",
});

const absoluteDateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
});

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MINIMUM_UPDATE_DELAY = SECOND;

export function formatRelativeDate(value: string | number | Date, now: Date = new Date()): string {
  const date = new Date(value);
  const timestamp = date.getTime();

  if (!Number.isFinite(timestamp)) {
    return "Unknown date";
  }

  const diff = timestamp - now.getTime();
  const absoluteDiff = Math.abs(diff);

  if (absoluteDiff < MINUTE) {
    return relativeTimeFormatter.format(0, "second");
  }

  if (absoluteDiff < HOUR) {
    return relativeTimeFormatter.format(Math.trunc(diff / MINUTE), "minute");
  }

  if (absoluteDiff < DAY) {
    return relativeTimeFormatter.format(Math.trunc(diff / HOUR), "hour");
  }

  if (absoluteDiff < 2 * DAY) {
    return relativeTimeFormatter.format(Math.round(diff / DAY), "day");
  }

  return absoluteDateFormatter.format(date);
}

export function millisecondsUntilRelativeDateUpdate(
  value: string | number | Date,
  now: Date = new Date(),
): number | undefined {
  const date = new Date(value);
  const timestamp = date.getTime();

  if (!Number.isFinite(timestamp)) {
    return undefined;
  }

  const nowTimestamp = now.getTime();
  const diff = timestamp - nowTimestamp;
  const absoluteDiff = Math.abs(diff);

  if (absoluteDiff >= 2 * DAY) {
    return undefined;
  }

  if (absoluteDiff < MINUTE) {
    return delayUntil(timestamp + MINUTE, nowTimestamp);
  }

  if (absoluteDiff < HOUR) {
    return delayUntilNextTruncatedUnitChange(diff, timestamp, nowTimestamp, MINUTE);
  }

  if (absoluteDiff < DAY) {
    return delayUntilNextTruncatedUnitChange(diff, timestamp, nowTimestamp, HOUR);
  }

  if (diff < 0) {
    const elapsed = nowTimestamp - timestamp;
    return delayUntil(timestamp + (elapsed < 1.5 * DAY ? 1.5 * DAY : 2 * DAY), nowTimestamp);
  }

  return delayUntil(timestamp - DAY, nowTimestamp);
}

function delayUntilNextTruncatedUnitChange(
  diff: number,
  timestamp: number,
  nowTimestamp: number,
  unit: number,
) {
  const absoluteUnits = Math.floor(Math.abs(diff) / unit);
  const nextTimestamp =
    diff < 0 ? timestamp + (absoluteUnits + 1) * unit : timestamp - absoluteUnits * unit;

  return delayUntil(nextTimestamp, nowTimestamp);
}

function delayUntil(timestamp: number, nowTimestamp: number) {
  return Math.max(MINIMUM_UPDATE_DELAY, Math.ceil(timestamp - nowTimestamp));
}
