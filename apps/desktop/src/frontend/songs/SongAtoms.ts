import { DateTime } from "effect";
import { Atom, AsyncResult } from "effect/unstable/reactivity";
import {
  makeTemporaryId,
  songIdPrefix,
  songsRpcReactivityKey,
  type ShowId,
  type Song,
  type SongId,
} from "@showtime/contracts";
import { RpcClient } from "@/frontend/rpc/RpcClient";

const createSongMutation = RpcClient.mutation("CreateSong");
const deleteSongMutation = RpcClient.mutation("DeleteSong");
const reorderSongsMutation = RpcClient.mutation("ReorderSongs");
const editSongMutation = RpcClient.mutation("EditSong");

export type SongListItem = Song & { readonly pending?: boolean };
type MutationInput<T> = T extends Atom.AtomResultFn<infer Arg, infer _A, infer _E> ? Arg : never;
const makeTemporarySongId = (): SongId => makeTemporaryId(songIdPrefix) as SongId;

export const songAtoms = Atom.family((showId: ShowId) => {
  const query = RpcClient.query(
    "ListSongs",
    { showId },
    {
      reactivityKeys: songsRpcReactivityKey(showId),
      serializationKey: showId,
      timeToLive: "5 minutes",
    },
  ).pipe(
    Atom.swr({
      staleTime: 10_000,
      revalidateOnMount: true,
      revalidateOnFocus: true,
      focusSignal: Atom.windowFocusSignal,
    }),
    Atom.keepAlive,
  );
  const songs = query.pipe(Atom.optimistic, Atom.keepAlive);
  const create = songs.pipe(
    Atom.optimisticFn({
      reducer: (current, input: MutationInput<typeof createSongMutation>) => {
        if (!AsyncResult.isSuccess(current)) return current;
        const now = DateTime.nowUnsafe();
        const song: SongListItem = {
          id: makeTemporarySongId(),
          name: input.payload.name,
          artist: input.payload.artist,
          mixAssignments: [],
          createdAt: now,
          updatedAt: now,
          pending: true,
        };
        return AsyncResult.success([...current.value, song]);
      },
      fn: createSongMutation,
    }),
    Atom.keepAlive,
  );
  const deleteSong = songs.pipe(
    Atom.optimisticFn({
      reducer: (current, input: MutationInput<typeof deleteSongMutation>) =>
        AsyncResult.isSuccess(current)
          ? AsyncResult.success(current.value.filter((song) => song.id !== input.payload.id))
          : current,
      fn: deleteSongMutation,
    }),
    Atom.keepAlive,
  );
  const edit = songs.pipe(
    Atom.optimisticFn({
      reducer: (current, input: MutationInput<typeof editSongMutation>) => {
        if (!AsyncResult.isSuccess(current)) return current;
        return AsyncResult.success(
          current.value.map((song) =>
            song.id === input.payload.id
              ? {
                  ...song,
                  name: input.payload.name,
                  artist: input.payload.artist,
                  mixAssignments: input.payload.mixAssignments,
                  microphoneNames: input.payload.microphoneNames,
                  ...(input.payload.notes ? { notes: input.payload.notes } : { notes: undefined }),
                }
              : song,
          ),
        );
      },
      fn: editSongMutation,
    }),
    Atom.keepAlive,
  );
  const reorder = songs.pipe(
    Atom.optimisticFn({
      reducer: (current, input: MutationInput<typeof reorderSongsMutation>) => {
        if (!AsyncResult.isSuccess(current)) return current;
        const byId = new Map(current.value.map((song) => [song.id, song]));
        return AsyncResult.success(
          input.payload.orderedSongIds.flatMap((id) => {
            const song = byId.get(id);
            return song ? [song] : [];
          }),
        );
      },
      fn: reorderSongsMutation,
    }),
    Atom.keepAlive,
  );
  return { songs, create, edit, delete: deleteSong, reorder } as const;
});
