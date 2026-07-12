import type { ShowId } from "./show.js";

export const showsSyncKey = ["shows"] as const;
export const microphonesSyncKey = (showId: ShowId) => [`microphones:${showId}`] as const;
export const mixesSyncKey = (showId: ShowId) => [`mixes:${showId}`] as const;
export const songsSyncKey = (showId: ShowId) => [`songs:${showId}`] as const;
