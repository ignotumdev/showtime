import { Option } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";

export function isFailureWithoutValue<A, E>(result: AsyncResult.AsyncResult<A, E>): boolean {
  return AsyncResult.isFailure(result) && Option.isNone(AsyncResult.value(result));
}
