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

export function formatRelativeDate(value: string | number | Date, now: Date = new Date()): string {
  const date = new Date(value);
  const timestamp = date.getTime();

  if (!Number.isFinite(timestamp)) {
    return "Unknown date";
  }

  const diff = timestamp - now.getTime();
  const absoluteDiff = Math.abs(diff);

  if (absoluteDiff < MINUTE) {
    return "Just now";
  }

  if (absoluteDiff < HOUR) {
    return relativeTimeFormatter.format(Math.round(diff / MINUTE), "minute");
  }

  if (absoluteDiff < DAY) {
    return relativeTimeFormatter.format(Math.round(diff / HOUR), "hour");
  }

  if (absoluteDiff < 2 * DAY) {
    return relativeTimeFormatter.format(Math.round(diff / DAY), "day");
  }

  return absoluteDateFormatter.format(date);
}
