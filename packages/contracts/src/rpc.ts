import { Schema } from "effect";
import { Rpc, RpcGroup as EffectRpcGroup } from "effect/unstable/rpc";
import { Microphone, MicrophoneId, MicrophoneNumber } from "./microphone.js";
import { Mix, MixId, MixNumber } from "./mix.js";
import { Color, ShowId, ShowName, ShowSummary } from "./show.js";

export const rpcHost = "127.0.0.1";
export const rpcPort = 34987;
export const rpcPathPrefix = "/rpc";

export const makeRpcPath = (token: string) => `${rpcPathPrefix}/${encodeURIComponent(token)}`;
export const makeRpcWebSocketUrl = (token: string) =>
  `ws://${rpcHost}:${rpcPort}${makeRpcPath(token)}`;

export class RpcError extends Schema.TaggedErrorClass<RpcError>()("RpcError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Defect()),
}) {}

export const RpcGroup = EffectRpcGroup.make(
  Rpc.make("ListShows", { success: Schema.Array(ShowSummary), error: RpcError }),
  Rpc.make("CreateShow", {
    payload: { name: ShowName, color: Color },
    success: ShowSummary,
    error: RpcError,
  }),
  Rpc.make("EditShow", {
    payload: { id: ShowId, name: ShowName, color: Color },
    success: ShowSummary,
    error: RpcError,
  }),
  Rpc.make("DeleteShow", {
    payload: { id: ShowId },
    success: Schema.Void,
    error: RpcError,
  }),
  Rpc.make("ListMicrophones", {
    payload: { showId: ShowId },
    success: Schema.Array(Microphone),
    error: RpcError,
  }),
  Rpc.make("CreateMicrophone", {
    payload: { showId: ShowId, color: Color },
    success: Microphone,
    error: RpcError,
  }),
  Rpc.make("EditMicrophone", {
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
  Rpc.make("DeleteMicrophone", {
    payload: { showId: ShowId, id: MicrophoneId },
    success: Schema.Void,
    error: RpcError,
  }),
  Rpc.make("ListMixes", {
    payload: { showId: ShowId },
    success: Schema.Array(Mix),
    error: RpcError,
  }),
  Rpc.make("CreateMix", {
    payload: { showId: ShowId, color: Color },
    success: Mix,
    error: RpcError,
  }),
  Rpc.make("EditMix", {
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
  Rpc.make("DeleteMix", {
    payload: { showId: ShowId, id: MixId },
    success: Schema.Void,
    error: RpcError,
  }),
);

export const showsRpcReactivityKey = ["shows"] as const;
export const microphonesRpcReactivityKey = (showId: ShowId) => ["microphones", showId] as const;
export const mixesRpcReactivityKey = (showId: ShowId) => ["mixes", showId] as const;
