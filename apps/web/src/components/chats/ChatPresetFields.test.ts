import { describe, expect, it } from "vite-plus/test";
import { chatPresetOptionsUseButtons } from "./ChatPresetFieldState";

describe("chat preset option inputs", () => {
  it("uses buttons for fewer than five options and a select from five onward", () => {
    expect(chatPresetOptionsUseButtons(["Yes", "No"])).toBe(true);
    expect(chatPresetOptionsUseButtons(["One", "Two", "Three", "Four"])).toBe(true);
    expect(chatPresetOptionsUseButtons(["One", "Two", "Three", "Four", "Five"])).toBe(false);
  });
});
