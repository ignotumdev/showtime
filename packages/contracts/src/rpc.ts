import { Schema } from "effect";
import { Rpc, RpcGroup as EffectRpcGroup } from "effect/unstable/rpc";
import { Microphone, MicrophoneId, MicrophoneNumber } from "./microphone.js";
import { ShowColor, ShowId, ShowName, ShowSummary } from "./show.js";

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
    payload: { name: ShowName, color: ShowColor },
    success: ShowSummary,
    error: RpcError,
  }),
  Rpc.make("EditShow", {
    payload: { id: ShowId, name: ShowName, color: ShowColor },
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
    payload: { showId: ShowId, color: ShowColor },
    success: Microphone,
    error: RpcError,
  }),
  Rpc.make("EditMicrophone", {
    payload: {
      showId: ShowId,
      id: MicrophoneId,
      number: MicrophoneNumber,
      color: ShowColor,
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
);

export const showsRpcReactivityKey = ["shows"] as const;
export const microphonesRpcReactivityKey = (showId: ShowId) => ["microphones", showId] as const;
