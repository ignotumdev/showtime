import { Option } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import type { ProfilesState } from "@showtime/contracts";

export const currentProfilesState = (
  result: AsyncResult.AsyncResult<ProfilesState, unknown>,
): ProfilesState | undefined =>
  AsyncResult.isSuccess(result)
    ? result.value
    : AsyncResult.isFailure(result)
      ? Option.getOrUndefined(result.previousSuccess)?.value
      : undefined;
