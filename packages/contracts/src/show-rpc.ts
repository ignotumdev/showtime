import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";
import {
  Microphone,
  MicrophoneId,
  MicrophoneNumber,
  ShowColor,
  ShowId,
  ShowName,
  ShowSummary,
} from "./show.js";

export const showRpcHost = "127.0.0.1";
export const showRpcPort = 34987;
export const showRpcPathPrefix = "/rpc";

export const makeShowRpcPath = (token: string) =>
  `${showRpcPathPrefix}/${encodeURIComponent(token)}`;

export const makeShowRpcWebSocketUrl = (token: string) =>
  `ws://${showRpcHost}:${showRpcPort}${makeShowRpcPath(token)}`;

export class ShowRpcError extends Schema.TaggedErrorClass<ShowRpcError>()("ShowRpcError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Defect()),
}) {}

export const ShowRpcGroup = RpcGroup.make(
  Rpc.make("ListShows", {
    success: Schema.Array(ShowSummary),
    error: ShowRpcError,
  }),
  Rpc.make("CreateShow", {
    payload: {
      name: ShowName,
      color: ShowColor,
    },
    success: ShowSummary,
    error: ShowRpcError,
  }),
  Rpc.make("EditShow", {
    payload: {
      id: ShowId,
      name: ShowName,
      color: ShowColor,
    },
    success: ShowSummary,
    error: ShowRpcError,
  }),
  Rpc.make("DeleteShow", {
    payload: {
      id: ShowId,
    },
    success: Schema.Void,
    error: ShowRpcError,
  }),
  Rpc.make("ListMicrophones", {
    payload: { showId: ShowId },
    success: Schema.Array(Microphone),
    error: ShowRpcError,
  }),
  Rpc.make("CreateMicrophone", {
    payload: { showId: ShowId, color: ShowColor },
    success: Microphone,
    error: ShowRpcError,
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
    error: ShowRpcError,
  }),
  Rpc.make("DeleteMicrophone", {
    payload: { showId: ShowId, id: MicrophoneId },
    success: Schema.Void,
    error: ShowRpcError,
  }),
);

export const showRpcReactivityKey = ["shows"] as const;
export const microphonesRpcReactivityKey = (showId: ShowId) => ["microphones", showId] as const;
