import { Option } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import { describe, expect, it } from "vite-plus/test";
import { isFailureWithoutValue } from "./AsyncResult.js";

describe("isFailureWithoutValue", () => {
  it("keeps a failed refresh available when it retained an empty value", () => {
    const previousSuccess = AsyncResult.success<ReadonlyArray<string>, string>([]);
    const result = AsyncResult.fail<string, ReadonlyArray<string>>("offline", {
      previousSuccess: Option.some(previousSuccess),
    });

    expect(isFailureWithoutValue(result)).toBe(false);
  });

  it("identifies a failure that has never loaded a value", () => {
    expect(isFailureWithoutValue(AsyncResult.fail("offline"))).toBe(true);
  });

  it("does not identify success or initial states as unavailable failures", () => {
    expect(isFailureWithoutValue(AsyncResult.success([]))).toBe(false);
    expect(isFailureWithoutValue(AsyncResult.initial())).toBe(false);
  });
});
