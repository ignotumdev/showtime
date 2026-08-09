import { describe, expect, it } from "vite-plus/test";
import type { Color } from "@showtime/contracts";
import { isUnchangedShowSave } from "./GeneralSettings";

const blue = "blue" as Color;
const red = "red" as Color;

describe("isUnchangedShowSave", () => {
  it("skips an unchanged save when no other save is pending", () => {
    expect(
      isUnchangedShowSave({ name: "Show A", color: blue }, { name: "Show A", color: blue }, 0),
    ).toBe(true);
  });

  it("queues a revert while an earlier save is pending", () => {
    expect(
      isUnchangedShowSave({ name: "Show A", color: blue }, { name: "Show A", color: blue }, 1),
    ).toBe(false);
  });

  it("does not skip changed names or colors", () => {
    expect(
      isUnchangedShowSave({ name: "Show B", color: blue }, { name: "Show A", color: blue }, 0),
    ).toBe(false);
    expect(
      isUnchangedShowSave({ name: "Show A", color: red }, { name: "Show A", color: blue }, 0),
    ).toBe(false);
  });
});
