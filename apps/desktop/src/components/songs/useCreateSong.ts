import * as React from "react";
import { Exit } from "effect";
import { useNavigate } from "@tanstack/react-router";
import {
  songsRpcReactivityKey,
  type ShowId,
  type SongArtist,
  type SongName,
} from "@showtime/contracts";
import { useAtomSet } from "@/frontend/react/AtomProvider";
import { rpcErrorMessageFromCause } from "@/frontend/rpc/errors";
import { songAtoms } from "@/frontend/songs/SongAtoms";

export function useCreateSong(showId: ShowId) {
  const navigate = useNavigate();
  const create = useAtomSet(songAtoms(showId).create, { mode: "promiseExit" });
  const [isCreating, setIsCreating] = React.useState(false);
  const [error, setError] = React.useState<string>();

  const createSong = async () => {
    if (isCreating) return;
    setIsCreating(true);
    setError(undefined);
    const result = await create({
      payload: { showId, name: "" as SongName, artist: "" as SongArtist },
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
