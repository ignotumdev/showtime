import type { Atom } from "effect/unstable/reactivity";

export interface StreamingRpcOptions {
  /** Signals that recreate a completed or failed streaming RPC subscription. */
  readonly refreshSignals?: ReadonlyArray<Atom.Atom<unknown>>;
}
