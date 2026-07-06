import { Cause, Option } from "effect";
import { ShowRpcError } from "@showtime/contracts";

const genericMessage = "Try again in a moment.";

export const showRpcErrorMessageFromCause = (cause: Cause.Cause<unknown>) => {
  const error = Option.getOrUndefined(Cause.findErrorOption(cause));

  if (error instanceof ShowRpcError && error.message.trim().length > 0) {
    return error.message;
  }

  return genericMessage;
};
