import * as React from "react";
import { Exit } from "effect";
import { useNavigate } from "@tanstack/react-router";
import { type ShowId, type SongArtist, type SongId, type SongName } from "@showtime/contracts";
import { useAtomSet } from "@effect/atom-react";
import { rpcErrorMessageFromCause, songAtoms, songsRpcReactivityKey } from "@/client";

export function useCreateSong(showId: ShowId, insertAfterSongId?: SongId) {
  const navigate = useNavigate();
  const create = useAtomSet(songAtoms(showId).create, { mode: "promiseExit" });
  const [isCreating, setIsCreating] = React.useState(false);
  const [error, setError] = React.useState<string>();

  const createSong = async () => {
    if (isCreating) return;
    setIsCreating(true);
    setError(undefined);
    const result = await create({
      payload: {
        showId,
        name: "" as SongName,
        artist: "" as SongArtist,
        insertAfterSongId,
      },
      reactivityKeys: songsRpcReactivityKey(showId),
    });
    if (Exit.isFailure(result)) {
      setError(rpcErrorMessageFromCause(result.cause));
      setIsCreating(false);
      return;
    }
    await navigate({
      to: "/shows/$showId/setlist/$songId",
      params: { showId, songId: result.value.id },
    });
    setIsCreating(false);
  };

  return { createSong, isCreating, error } as const;
}
