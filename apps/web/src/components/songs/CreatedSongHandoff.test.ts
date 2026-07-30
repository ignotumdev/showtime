import { describe, expect, it } from "vite-plus/test";
import { Schema } from "effect";
import { Song, SongName, type ShowId, type SongId } from "@showtime/contracts";
import { makeCreatedSongHandoff } from "./CreatedSongHandoff";

const showId = "show_0123456789abcdef" as ShowId;
const song = Schema.decodeUnknownSync(Song)({
  id: "song_0123456789abcdef" as SongId,
  name: "",
  artist: "",
  mixAssignments: [],
  createdAt: "2026-07-24T12:00:00.000Z",
  updatedAt: "2026-07-24T12:00:00.000Z",
});

describe("CreatedSongHandoff", () => {
  it("retains a confirmed creation until the streamed snapshot observes it", () => {
    const handoff = makeCreatedSongHandoff();
    const baselineSnapshot = {};

    handoff.remember(showId, song, undefined, baselineSnapshot);
    expect(handoff.find(showId, song.id)).toBe(song);

    handoff.reconcile(showId, [], baselineSnapshot);
    expect(handoff.find(showId, song.id)).toBe(song);

    handoff.reconcile(showId, [song], {});
    expect(handoff.find(showId, song.id)).toBeUndefined();
  });

  it("can forget a creation after it is deleted before reconciliation", () => {
    const handoff = makeCreatedSongHandoff();

    handoff.remember(showId, song, undefined, {});
    handoff.forget(showId, song.id);

    expect(handoff.find(showId, song.id)).toBeUndefined();
  });

  it("preserves the intended insertion position while the snapshot is delayed", () => {
    const handoff = makeCreatedSongHandoff();
    const anchor = {
      ...song,
      id: "song_fedcba9876543210" as SongId,
      name: SongName.make("Anchor"),
    };

    handoff.remember(showId, song, anchor.id, {});

    expect(handoff.provisionalNumber(showId, song.id, [anchor])).toBe(2);
  });

  it("expires a confirmed creation when a newer authoritative snapshot omits it", () => {
    const handoff = makeCreatedSongHandoff();
    const baselineSnapshot = {};

    handoff.remember(showId, song, undefined, baselineSnapshot);
    handoff.reconcile(showId, [], {});

    expect(handoff.find(showId, song.id)).toBeUndefined();
  });
});
