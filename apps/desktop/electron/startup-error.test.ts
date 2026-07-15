import { describe, expect, it } from "vite-plus/test";
import { formatStartupError } from "./startup-error.js";

describe("formatStartupError", () => {
  it("uses the message from Error instances", () => {
    expect(formatStartupError(new Error("Port already in use"))).toBe("Port already in use");
  });

  it("uses the message from serialized error objects", () => {
    expect(
      formatStartupError({ message: "Database could not be opened", code: "SQLITE_BUSY" }),
    ).toBe("Database could not be opened");
  });

  it("falls back to converting other thrown values to strings", () => {
    expect(formatStartupError("Startup interrupted")).toBe("Startup interrupted");
    expect(formatStartupError(42)).toBe("42");
  });
});
