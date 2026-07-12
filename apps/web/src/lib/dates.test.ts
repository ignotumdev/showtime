import { describe, expect, it } from "vite-plus/test";
import { formatRelativeDate, millisecondsUntilRelativeDateUpdate } from "./dates";

describe("formatRelativeDate", () => {
  it("formats values relative to the provided clock", () => {
    const now = new Date("2026-07-06T12:01:00.000Z");

    expect(formatRelativeDate("2026-07-06T12:00:00.000Z", now)).toBe("1 minute ago");
  });
});

describe("millisecondsUntilRelativeDateUpdate", () => {
  it("returns the delay until a recent past date stops formatting as now", () => {
    const now = new Date("2026-07-06T12:00:30.000Z");

    expect(millisecondsUntilRelativeDateUpdate("2026-07-06T12:00:00.000Z", now)).toBe(30_000);
  });

  it("returns the delay until a minute label changes", () => {
    const now = new Date("2026-07-06T12:01:15.000Z");

    expect(millisecondsUntilRelativeDateUpdate("2026-07-06T12:00:00.000Z", now)).toBe(45_000);
  });

  it("does not schedule updates for absolute dates", () => {
    const now = new Date("2026-07-06T12:00:00.000Z");

    expect(millisecondsUntilRelativeDateUpdate("2026-07-03T12:00:00.000Z", now)).toBeUndefined();
  });
});
