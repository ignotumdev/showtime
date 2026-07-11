import { Cause, Option } from "effect";
import { RpcError } from "@showtime/contracts";

const genericMessage = "Try again in a moment.";

export const rpcErrorMessageFromCause = (cause: Cause.Cause<unknown>) => {
  const error = Option.getOrUndefined(Cause.findErrorOption(cause));

  if (error instanceof RpcError && error.message.trim().length > 0) {
    return error.message;
  }

  return genericMessage;
};
