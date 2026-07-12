import { describe, expect, it } from "vite-plus/test";
import type { ShowId } from "@showtime/contracts";
import {
  endLiveSession,
  formatLiveElapsed,
  getOrStartLiveSession,
  type LiveSessionStorage,
} from "./LiveSession";

class MemoryStorage implements LiveSessionStorage {
  readonly values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}

const firstShow = "show_0000000001" as ShowId;
const secondShow = "show_0000000002" as ShowId;

describe("live sessions", () => {
  it("resumes a show without changing its start time", () => {
    const storage = new MemoryStorage();
    expect(getOrStartLiveSession(firstShow, 1_000, storage)).toBe(1_000);
    expect(getOrStartLiveSession(firstShow, 9_000, storage)).toBe(1_000);
  });

  it("ending one show does not clear another", () => {
    const storage = new MemoryStorage();
    getOrStartLiveSession(firstShow, 1_000, storage);
    getOrStartLiveSession(secondShow, 2_000, storage);
    endLiveSession(firstShow, storage);
    expect(getOrStartLiveSession(firstShow, 3_000, storage)).toBe(3_000);
    expect(getOrStartLiveSession(secondShow, 3_000, storage)).toBe(2_000);
  });
});

describe("formatLiveElapsed", () => {
  it.each([
    [0, "0:00"],
    [61_000, "1:01"],
    [601_000, "10:01"],
    [3_661_000, "1:01:01"],
    [90_061_000, "25:01:01"],
  ])("formats %i milliseconds", (milliseconds, expected) => {
    expect(formatLiveElapsed(milliseconds)).toBe(expected);
  });
});
