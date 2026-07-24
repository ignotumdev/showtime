import { Option, Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { insertSongAfter, Song, type SongId } from "./song.js";

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

describe("insertSongAfter", () => {
  const first = { id: "song_0123456789abcdef" as SongId };
  const second = { id: "song_123456789abcdef0" as SongId };
  const inserted = { id: "song_23456789abcdef01" as SongId };

  it("inserts after the requested song", () => {
    expect(Option.getOrThrow(insertSongAfter([first, second], inserted, first.id))).toEqual([
      first,
      inserted,
      second,
    ]);
  });

  it("appends when no insertion point is requested", () => {
    expect(Option.getOrThrow(insertSongAfter([first, second], inserted))).toEqual([
      first,
      second,
      inserted,
    ]);
  });

  it("returns none when the requested song is absent", () => {
    expect(Option.isNone(insertSongAfter([first], inserted, second.id))).toBe(true);
  });
});
