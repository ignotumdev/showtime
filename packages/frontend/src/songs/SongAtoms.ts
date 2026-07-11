import { DateTime } from "effect";
import { Atom, AsyncResult } from "effect/unstable/reactivity";
import {
  makeTemporaryId,
  songIdPrefix,
  type ShowId,
  type Song,
  type SongId,
} from "@showtime/contracts";
import type { ShowtimeRpcClient } from "../rpc/RpcClient.js";
import { songsRpcReactivityKey } from "../rpc/Reactivity.js";

export type SongListItem = Song & { readonly pending?: boolean };
type MutationInput<T> = T extends Atom.AtomResultFn<infer Arg, infer _A, infer _E> ? Arg : never;
const makeTemporarySongId = (): SongId => makeTemporaryId(songIdPrefix) as SongId;

export const makeSongAtoms = (
  RpcClient: ShowtimeRpcClient,
  options?: { readonly focusSignal?: Atom.Atom<unknown> },
) => {
  const createSongMutation = RpcClient.mutation("songs.create");
  const deleteSongMutation = RpcClient.mutation("songs.delete");
  const reorderSongsMutation = RpcClient.mutation("songs.reorder");
  const editSongMutation = RpcClient.mutation("songs.edit");

  const songAtoms = Atom.family((showId: ShowId) => {
    const query = RpcClient.query(
      "songs.list",
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
        focusSignal: options?.focusSignal,
      }),
    );
    const songs = query.pipe(Atom.optimistic);
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
    );
    const deleteSong = songs.pipe(
      Atom.optimisticFn({
        reducer: (current, input: MutationInput<typeof deleteSongMutation>) =>
          AsyncResult.isSuccess(current)
            ? AsyncResult.success(current.value.filter((song) => song.id !== input.payload.id))
            : current,
        fn: deleteSongMutation,
      }),
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
                    ...(input.payload.notes
                      ? { notes: input.payload.notes }
                      : { notes: undefined }),
                  }
                : song,
            ),
          );
        },
        fn: editSongMutation,
      }),
    );
    const reorder = songs.pipe(
      Atom.optimisticFn({
        reducer: (current, input: MutationInput<typeof reorderSongsMutation>) => {
          if (!AsyncResult.isSuccess(current)) return current;
          const byId = new Map(current.value.map((song) => [song.id, song]));
          const orderedIds = new Set(input.payload.orderedSongIds);
          return AsyncResult.success([
            ...input.payload.orderedSongIds.flatMap((id) => {
              const song = byId.get(id);
              return song ? [song] : [];
            }),
            ...current.value.filter((song) => !orderedIds.has(song.id)),
          ]);
        },
        fn: reorderSongsMutation,
      }),
    );
    return { songs, create, edit, delete: deleteSong, reorder } as const;
  });

  return { songAtoms } as const;
};
