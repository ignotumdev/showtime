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
      microphones: [],
      mixes: [],
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
      mixes: [],
    });
  });

  it("decodes and encodes microphone lifecycle timestamps", () => {
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
      microphones: [
        {
          id: "mic_0123456789abcdef",
          number: 1,
          color: "rose",
          createdAt: "2026-07-02T10:02:00.000Z",
          updatedAt: "2026-07-02T10:03:00.000Z",
          deletedAt: "2026-07-02T10:04:00.000Z",
        },
      ],
      mixes: [],
    });

    expect(encode(decoded).microphones).toEqual([
      {
        id: "mic_0123456789abcdef",
        number: 1,
        color: "rose",
        createdAt: "2026-07-02T10:02:00.000Z",
        updatedAt: "2026-07-02T10:03:00.000Z",
        deletedAt: "2026-07-02T10:04:00.000Z",
      },
    ]);
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
        microphones: [],
        mixes: [],
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
          microphones: [],
          mixes: [],
        }),
      ),
    ).rejects.toThrow();
  });
});
