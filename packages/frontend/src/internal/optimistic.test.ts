import { describe, expect, it } from "vite-plus/test";
import { applyOptimisticNamedItemEdit } from "./optimistic.js";

const item = {
  id: "item-1",
  number: "1",
  color: "blue",
  name: "Lead",
  updatedAt: 1,
};

describe("applyOptimisticNamedItemEdit", () => {
  it("applies and normalizes an edit", () => {
    expect(
      applyOptimisticNamedItemEdit(
        item,
        { id: "item-1", number: "2", color: "red", name: "  Vocal  " },
        2,
      ),
    ).toEqual({ ...item, number: "2", color: "red", name: "Vocal", updatedAt: 2 });
  });

  it("clears a whitespace-only name", () => {
    expect(
      applyOptimisticNamedItemEdit(
        item,
        { id: "item-1", number: "1", color: "blue", name: "   " },
        2,
      ),
    ).toEqual({ ...item, name: undefined, updatedAt: 2 });
  });

  it("preserves an omitted name and ignores a different item", () => {
    expect(
      applyOptimisticNamedItemEdit(item, { id: "item-1", number: "2", color: "red" }, 2),
    ).toEqual({ ...item, number: "2", color: "red", updatedAt: 2 });
    expect(
      applyOptimisticNamedItemEdit(
        item,
        { id: "item-2", number: "2", color: "red", name: "Other" },
        2,
      ),
    ).toBe(item);
  });
});
