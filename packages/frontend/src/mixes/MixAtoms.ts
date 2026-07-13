import { DateTime } from "effect";
import { Atom, AsyncResult } from "effect/unstable/reactivity";
import {
  makeTemporaryId,
  MixNumber,
  mixIdPrefix,
  type Mix,
  type MixId,
  type ShowId,
} from "@showtime/contracts";
import type { ShowtimeRpcClient } from "../rpc/RpcClient.js";
import { applyOptimisticNamedItemEdit } from "../internal/optimistic.js";
import { latestSnapshot } from "../rpc/LatestSnapshot.js";
import type { StreamingRpcOptions } from "../rpc/StreamingRpcOptions.js";

export type MixListItem = Mix & { readonly pending?: boolean };
type MutationInput<T> = T extends Atom.AtomResultFn<infer Arg, infer _A, infer _E> ? Arg : never;
const makeTemporaryMixId = (): MixId => makeTemporaryId(mixIdPrefix) as MixId;

export const makeMixAtoms = (RpcClient: ShowtimeRpcClient, options?: StreamingRpcOptions) => {
  const createMixMutation = RpcClient.mutation("mixes.create");
  const deleteMixMutation = RpcClient.mutation("mixes.delete");
  const editMixMutation = RpcClient.mutation("mixes.edit");

  const mixAtoms = Atom.family((showId: ShowId) => {
    const query = latestSnapshot(RpcClient.query("mixes.list", { showId }), options);
    const mixes = query.pipe(Atom.optimistic);
    const create = mixes.pipe(
      Atom.optimisticFn({
        reducer: (current, input: MutationInput<typeof createMixMutation>) => {
          if (!AsyncResult.isSuccess(current)) return current;
          const currentMixes = current.value;
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
    );
    const edit = mixes.pipe(
      Atom.optimisticFn({
        reducer: (current, input: MutationInput<typeof editMixMutation>) => {
          if (!AsyncResult.isSuccess(current)) return current;
          const updatedAt = DateTime.nowUnsafe();
          return AsyncResult.success(
            current.value.map((mix) => applyOptimisticNamedItemEdit(mix, input.payload, updatedAt)),
          );
        },
        fn: editMixMutation,
      }),
    );
    const deleteMix = mixes.pipe(
      Atom.optimisticFn({
        reducer: (current, input: MutationInput<typeof deleteMixMutation>) => {
          if (!AsyncResult.isSuccess(current)) return current;
          return AsyncResult.success(current.value.filter((mix) => mix.id !== input.payload.id));
        },
        fn: deleteMixMutation,
      }),
    );
    return { mixes, create, edit, delete: deleteMix } as const;
  });

  return { mixAtoms } as const;
};
