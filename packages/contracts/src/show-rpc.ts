import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";
import { ShowColor, ShowId, ShowSummary } from "./show.js";

export const showRpcHost = "127.0.0.1";
export const showRpcPort = 34987;
export const showRpcPath = "/rpc";
export const showRpcWebSocketUrl = `ws://${showRpcHost}:${showRpcPort}${showRpcPath}`;

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
      name: Schema.String,
      color: ShowColor,
    },
    success: ShowSummary,
    error: ShowRpcError,
  }),
  Rpc.make("EditShow", {
    payload: {
      id: ShowId,
      name: Schema.String,
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
);

export const showRpcReactivityKey = ["shows"] as const;
