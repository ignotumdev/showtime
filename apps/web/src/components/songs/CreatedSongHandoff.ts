import type { ShowId, Song, SongId } from "@showtime/contracts";

const keyFor = (showId: ShowId, songId: SongId) => `${showId}:${songId}`;

export const makeCreatedSongHandoff = () => {
  const confirmed = new Map<string, { readonly song: Song; readonly insertAfterSongId?: SongId }>();

  const remember = (showId: ShowId, song: Song, insertAfterSongId?: SongId) => {
    confirmed.set(keyFor(showId, song.id), { song, insertAfterSongId });
  };

  const find = (showId: ShowId, songId: SongId) => confirmed.get(keyFor(showId, songId))?.song;

  const provisionalNumber = (showId: ShowId, songId: SongId, syncedSongs: ReadonlyArray<Song>) => {
    const entry = confirmed.get(keyFor(showId, songId));
    if (!entry?.insertAfterSongId) return syncedSongs.length + 1;
    const anchorIndex = syncedSongs.findIndex((song) => song.id === entry.insertAfterSongId);
    return anchorIndex < 0 ? syncedSongs.length + 1 : anchorIndex + 2;
  };

  const forget = (showId: ShowId, songId: SongId) => {
    confirmed.delete(keyFor(showId, songId));
  };

  const reconcile = (
    showId: ShowId,
    songs: ReadonlyArray<Song & { readonly pending?: boolean }>,
  ) => {
    for (const song of songs) {
      if (!song.pending) forget(showId, song.id);
    }
  };

  return { remember, find, forget, provisionalNumber, reconcile } as const;
};

/**
 * Bridges the short interval between a successful create response and the next
 * full songs snapshot. Entries are discarded as soon as that snapshot observes
 * them, so later deletions cannot be hidden by stale client state.
 */
export const createdSongHandoff = makeCreatedSongHandoff();
