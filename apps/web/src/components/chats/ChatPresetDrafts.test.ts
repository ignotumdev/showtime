import { describe, expect, it } from "vite-plus/test";
import {
  chatPresetDraftsForTemplate,
  chatPresetFieldDrafts,
  chatPresetFieldsFromDrafts,
} from "./ChatPresetDrafts";

describe("chat preset answer drafts", () => {
  it("preserves commas inside select option boundaries", () => {
    const fields = [
      {
        name: "position",
        type: "select",
        options: ["Stage left, then right", "Center"],
      },
    ] as const;

    expect(chatPresetFieldsFromDrafts(chatPresetFieldDrafts(fields))).toEqual(fields);
  });

  it("preserves explicitly recipient-supplied fields that overlap message fields", () => {
    const fields = [
      { name: "mic", type: "microphone" },
      { name: "status", type: "select", options: ["Ready", "Not ready"] },
    ] as const;

    const drafts = chatPresetDraftsForTemplate(
      "{{mic}} is {{status}}",
      chatPresetFieldDrafts(fields),
      new Set(["mic"]),
    );

    expect(chatPresetFieldsFromDrafts(drafts)).toEqual(fields);
  });

  it("treats a new overlapping answer placeholder as inherited", () => {
    const drafts = chatPresetDraftsForTemplate(
      "{{mic}} is {{status}}",
      chatPresetFieldDrafts([{ name: "status", type: "select", options: ["Ready", "Not ready"] }]),
      new Set(["mic"]),
    );

    expect(chatPresetFieldsFromDrafts(drafts)).toEqual([
      { name: "status", type: "select", options: ["Ready", "Not ready"] },
    ]);
  });
});
