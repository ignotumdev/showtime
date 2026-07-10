import { describe, expect, it } from "vite-plus/test";
import { Effect, Schema } from "effect";
import { ShowFileDocument } from "./show.js";

const decode = Schema.decodeUnknownSync(ShowFileDocument);
const encode = Schema.encodeSync(ShowFileDocument);

describe("ShowFileDocument", () => {
  it("decodes and encodes Effect DateTime values from JSON strings", () => {
    const decoded = decode({
      type: "showtime-show",
      version: "dev",
      config: {
        id: "show_0123456789abcdef",
        name: "Soundcheck",
        color: "sky",
        createdAt: "2026-07-02T10:00:00.000Z",
        updatedAt: "2026-07-02T10:01:00.000Z",
      },
    });

    expect(encode(decoded)).toEqual({
      type: "showtime-show",
      version: "dev",
      config: {
        id: "show_0123456789abcdef",
        name: "Soundcheck",
        color: "sky",
        createdAt: "2026-07-02T10:00:00.000Z",
        updatedAt: "2026-07-02T10:01:00.000Z",
      },
      microphones: [],
    });
  });

  it("decodes microphones and supplies an empty list for legacy show files", () => {
    const legacy = decode({
      type: "showtime-show",
      version: "dev",
      config: {
        id: "show_0123456789abcdef",
        name: "Soundcheck",
        color: "sky",
        createdAt: "2026-07-02T10:00:00.000Z",
        updatedAt: "2026-07-02T10:01:00.000Z",
      },
    });

    expect(legacy.microphones).toEqual([]);
  });

  it("rejects blank show names", () => {
    expect(() =>
      decode({
        type: "showtime-show",
        version: "dev",
        config: {
          id: "show_0123456789abcdef",
          name: "   ",
          color: "sky",
          createdAt: "2026-07-02T10:00:00.000Z",
          updatedAt: "2026-07-02T10:00:00.000Z",
        },
      }),
    ).toThrow();
  });

  it("fails invalid JSON date values through the Effect decoder", async () => {
    await expect(
      Effect.runPromise(
        Schema.decodeUnknownEffect(ShowFileDocument)({
          type: "showtime-show",
          version: "dev",
          config: {
            id: "show_0123456789abcdef",
            name: "Soundcheck",
            color: "sky",
            createdAt: "not-a-date",
            updatedAt: "2026-07-02T10:00:00.000Z",
          },
        }),
      ),
    ).rejects.toThrow();
  });
});
