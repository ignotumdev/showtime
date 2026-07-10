import { DateTime } from "effect";
import { Atom, AsyncResult } from "effect/unstable/reactivity";
import {
  makeTemporaryId,
  MixNumber,
  mixIdPrefix,
  mixesRpcReactivityKey,
  type Mix,
  type MixId,
  type ShowId,
} from "@showtime/contracts";
import { RpcClient } from "@/frontend/rpc/RpcClient";

const createMixMutation = RpcClient.mutation("CreateMix");
const deleteMixMutation = RpcClient.mutation("DeleteMix");
export const editMixAtom = RpcClient.mutation("EditMix").pipe(Atom.keepAlive);

export type MixListItem = Mix & { readonly pending?: boolean };
type MutationInput<T> = T extends Atom.AtomResultFn<infer Arg, infer _A, infer _E> ? Arg : never;
const makeTemporaryMixId = (): MixId => makeTemporaryId(mixIdPrefix) as MixId;

export const mixAtoms = Atom.family((showId: ShowId) => {
  const query = RpcClient.query(
    "ListMixes",
    { showId },
    {
      reactivityKeys: mixesRpcReactivityKey(showId),
      serializationKey: showId,
      timeToLive: "5 minutes",
    },
  ).pipe(
    Atom.swr({
      staleTime: 10_000,
      revalidateOnMount: true,
      revalidateOnFocus: true,
      focusSignal: Atom.windowFocusSignal,
    }),
    Atom.keepAlive,
  );
  const mixes = query.pipe(Atom.optimistic, Atom.keepAlive);
  const create = mixes.pipe(
    Atom.optimisticFn({
      reducer: (current, input: MutationInput<typeof createMixMutation>) => {
        const currentMixes = AsyncResult.isSuccess(current) ? current.value : [];
        const nextNumber = MixNumber.make(
          String(
            Math.max(
              0,
              ...currentMixes.map((mix) => Number(mix.number)).filter(Number.isSafeInteger),
            ) + 1,
          ),
        );
        const now = DateTime.nowUnsafe();
        const mix: MixListItem = {
          id: makeTemporaryMixId(),
          number: nextNumber,
          color: input.payload.color,
          createdAt: now,
          updatedAt: now,
          pending: true,
        };
        return AsyncResult.success([...currentMixes, mix]);
      },
      fn: createMixMutation,
    }),
    Atom.keepAlive,
  );
  const deleteMix = mixes.pipe(
    Atom.optimisticFn({
      reducer: (current, input: MutationInput<typeof deleteMixMutation>) => {
        if (!AsyncResult.isSuccess(current)) return current;
        return AsyncResult.success(current.value.filter((mix) => mix.id !== input.payload.id));
      },
      fn: deleteMixMutation,
    }),
    Atom.keepAlive,
  );
  return { mixes, create, delete: deleteMix } as const;
});
