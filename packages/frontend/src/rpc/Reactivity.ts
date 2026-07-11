import type { ShowId } from "@showtime/contracts";

export const showsRpcReactivityKey = ["shows"] as const;
export const microphonesRpcReactivityKey = (showId: ShowId) => ["microphones", showId] as const;
export const mixesRpcReactivityKey = (showId: ShowId) => ["mixes", showId] as const;
export const songsRpcReactivityKey = (showId: ShowId) => ["songs", showId] as const;
