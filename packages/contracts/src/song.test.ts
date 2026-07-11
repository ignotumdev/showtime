import { Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { Song } from "./song.js";

const valid = {
  id: "song_0123456789abcdef",
  name: "Fix You",
  artist: "Coldplay",
  mixAssignments: [{ mixId: "mix_main", microphoneIds: ["mic_0123456789abcdef"] }],
  microphoneNames: [{ microphoneId: "mic_0123456789abcdef", name: "Lead" }],
  createdAt: "2026-07-10T20:00:00.000Z",
  updatedAt: "2026-07-10T20:00:00.000Z",
};

describe("Song", () => {
  const decode = Schema.decodeUnknownSync(Song);

  it("accepts a normalized song", () => {
    expect(decode(valid)).toMatchObject({ name: "Fix You", artist: "Coldplay" });
  });

  it("accepts blank names and artists", () => {
    expect(decode({ ...valid, name: "", artist: "" })).toMatchObject({ name: "", artist: "" });
  });

  it("rejects duplicate mixes and microphones", () => {
    expect(() =>
      decode({
        ...valid,
        mixAssignments: [valid.mixAssignments[0], valid.mixAssignments[0]],
      }),
    ).toThrow();
    expect(() =>
      decode({
        ...valid,
        mixAssignments: [
          {
            mixId: "mix_main",
            microphoneIds: ["mic_0123456789abcdef", "mic_0123456789abcdef"],
          },
        ],
      }),
    ).toThrow();
    expect(() =>
      decode({
        ...valid,
        microphoneNames: [valid.microphoneNames[0], valid.microphoneNames[0]],
      }),
    ).toThrow();
  });
});
