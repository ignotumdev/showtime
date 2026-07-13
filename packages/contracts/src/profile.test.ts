import { DateTime, Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { Profile } from "./profile.js";

const validProfile = {
  id: "profile_1234567890abcdef",
  name: "Default",
  color: "sky",
  createdAt: "2026-07-13T10:00:00.000Z",
  updatedAt: "2026-07-13T10:01:00.000Z",
} as const;

describe("Profile", () => {
  it("decodes timestamps as UTC date-times", () => {
    const profile = Schema.decodeUnknownSync(Profile)(validProfile);

    expect(DateTime.formatIso(profile.createdAt)).toBe(validProfile.createdAt);
    expect(DateTime.formatIso(profile.updatedAt)).toBe(validProfile.updatedAt);
  });

  it("rejects invalid timestamps", () => {
    expect(() =>
      Schema.decodeUnknownSync(Profile)({ ...validProfile, createdAt: "not-a-date" }),
    ).toThrow();
  });
});
