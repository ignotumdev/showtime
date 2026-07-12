import { Atom, AsyncResult } from "effect/unstable/reactivity";

/** Continuously drains an RPC stream while exposing only its newest full snapshot. */
export const latestSnapshot = <A, E>(source: Atom.Writable<Atom.PullResult<A, E>, void>) =>
  Atom.readable((get) => {
    const latest = (result: Atom.PullResult<A, E>) =>
      AsyncResult.map(result, ({ items }) => items[items.length - 1]!);

    const initial = latest(get.once(source));
    get.subscribe(source, (result) => {
      get.setSelf(latest(result));
      if (AsyncResult.isSuccess(result) && !result.value.done) {
        get.set(source, undefined);
      }
    });
    return initial;
  });
