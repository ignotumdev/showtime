import { describe, expect, it } from "vite-plus/test";
import { profileSelectionStorageKey, readProfileSelection } from "./profile-selection";

const storageWith = (value: string | null) => ({
  getItem: (key: string) => (key === profileSelectionStorageKey ? value : null),
});

describe("profile selection persistence", () => {
  it("returns a valid branded profile ID", () => {
    expect(
      readProfileSelection(
        storageWith(JSON.stringify({ version: 1, profileId: "profile_0000000000000000" })),
      ),
    ).toBe("profile_0000000000000000");
  });

  it("rejects strings that are not profile IDs", () => {
    expect(
      readProfileSelection(storageWith(JSON.stringify({ version: 1, profileId: "corrupted" }))),
    ).toBeUndefined();
  });

  it("rejects malformed storage", () => {
    expect(readProfileSelection(storageWith("not-json"))).toBeUndefined();
  });
});
