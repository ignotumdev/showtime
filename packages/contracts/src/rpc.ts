import { Schema } from "effect";
import { Rpc, RpcGroup as EffectRpcGroup } from "effect/unstable/rpc";
import { Microphone, MicrophoneId, MicrophoneNumber } from "./microphone.js";
import { Mix, MixId, MixNumber } from "./mix.js";
import {
  Song,
  SongArtist,
  SongId,
  SongMicrophoneName,
  SongMixAssignment,
  SongName,
} from "./song.js";
import { Color, ShowId, ShowName, ShowSummary } from "./show.js";

export class RpcError extends Schema.TaggedErrorClass<RpcError>()("RpcError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Defect()),
}) {}

export const ShowtimeRpcs = EffectRpcGroup.make(
  Rpc.make("shows.list", { success: Schema.Array(ShowSummary), error: RpcError, stream: true }),
  Rpc.make("shows.create", {
    payload: { name: ShowName, color: Color },
    success: ShowSummary,
    error: RpcError,
  }),
  Rpc.make("shows.edit", {
    payload: { id: ShowId, name: ShowName, color: Color },
    success: ShowSummary,
    error: RpcError,
  }),
  Rpc.make("shows.delete", {
    payload: { id: ShowId },
    success: Schema.Void,
    error: RpcError,
  }),
  Rpc.make("microphones.list", {
    payload: { showId: ShowId },
    success: Schema.Array(Microphone),
    error: RpcError,
    stream: true,
  }),
  Rpc.make("microphones.create", {
    payload: { showId: ShowId, color: Color },
    success: Microphone,
    error: RpcError,
  }),
  Rpc.make("microphones.edit", {
    payload: {
      showId: ShowId,
      id: MicrophoneId,
      number: MicrophoneNumber,
      color: Color,
      name: Schema.optional(Schema.String),
    },
    success: Microphone,
    error: RpcError,
  }),
  Rpc.make("microphones.delete", {
    payload: { showId: ShowId, id: MicrophoneId },
    success: Schema.Void,
    error: RpcError,
  }),
  Rpc.make("mixes.list", {
    payload: { showId: ShowId },
    success: Schema.Array(Mix),
    error: RpcError,
    stream: true,
  }),
  Rpc.make("mixes.create", {
    payload: { showId: ShowId, color: Color },
    success: Mix,
    error: RpcError,
  }),
  Rpc.make("mixes.edit", {
    payload: {
      showId: ShowId,
      id: MixId,
      number: MixNumber,
      color: Color,
      name: Schema.optional(Schema.String),
    },
    success: Mix,
    error: RpcError,
  }),
  Rpc.make("mixes.delete", {
    payload: { showId: ShowId, id: MixId },
    success: Schema.Void,
    error: RpcError,
  }),
  Rpc.make("songs.list", {
    payload: { showId: ShowId },
    success: Schema.Array(Song),
    error: RpcError,
    stream: true,
  }),
  Rpc.make("songs.create", {
    payload: { showId: ShowId, name: SongName, artist: SongArtist },
    success: Song,
    error: RpcError,
  }),
  Rpc.make("songs.edit", {
    payload: {
      showId: ShowId,
      id: SongId,
      name: SongName,
      artist: SongArtist,
      notes: Schema.optional(Schema.String),
      mixAssignments: Schema.Array(SongMixAssignment),
      microphoneNames: Schema.Array(SongMicrophoneName),
    },
    success: Song,
    error: RpcError,
  }),
  Rpc.make("songs.reorder", {
    payload: { showId: ShowId, orderedSongIds: Schema.Array(SongId) },
    success: Schema.Array(Song),
    error: RpcError,
  }),
  Rpc.make("songs.delete", {
    payload: { showId: ShowId, id: SongId },
    success: Schema.Void,
    error: RpcError,
  }),
);
