import { DateTime } from "effect";
import { Atom, AsyncResult } from "effect/unstable/reactivity";
import {
  makeTemporaryId,
  nextMicrophoneNumber,
  microphoneIdPrefix,
  type Microphone,
  type MicrophoneId,
  type ShowId,
} from "@showtime/contracts";
import type { ShowtimeRpcClient } from "../rpc/RpcClient.js";
import { applyOptimisticNamedItemEdit } from "../internal/optimistic.js";
import { latestSnapshot } from "../rpc/LatestSnapshot.js";

export type MicrophoneListItem = Microphone & { readonly pending?: boolean };

type MutationInput<T> = T extends Atom.AtomResultFn<infer Arg, infer _A, infer _E> ? Arg : never;

const makeTemporaryMicrophoneId = (): MicrophoneId =>
  makeTemporaryId(microphoneIdPrefix) as MicrophoneId;

export const makeMicrophoneAtoms = (
  RpcClient: ShowtimeRpcClient,
  _options?: { readonly focusSignal?: Atom.Atom<unknown> },
) => {
  const createMicrophoneMutation = RpcClient.mutation("microphones.create");
  const deleteMicrophoneMutation = RpcClient.mutation("microphones.delete");
  const editMicrophoneMutation = RpcClient.mutation("microphones.edit");

  const microphoneAtoms = Atom.family((showId: ShowId) => {
    const query = RpcClient.query("microphones.list", { showId }).pipe(latestSnapshot);
    const microphones = query.pipe(Atom.optimistic);
    const create = microphones.pipe(
      Atom.optimisticFn({
        reducer: (current, input: MutationInput<typeof createMicrophoneMutation>) => {
          if (!AsyncResult.isSuccess(current)) return current;
          const nextNumber = nextMicrophoneNumber(current.value.map((mic) => mic.number));
          const now = DateTime.nowUnsafe();
          const microphone: MicrophoneListItem = {
            id: makeTemporaryMicrophoneId(),
            number: nextNumber,
            color: input.payload.color,
            createdAt: now,
            updatedAt: now,
            pending: true,
          };
          return AsyncResult.success([...current.value, microphone]);
        },
        fn: createMicrophoneMutation,
      }),
    );
    const edit = microphones.pipe(
      Atom.optimisticFn({
        reducer: (current, input: MutationInput<typeof editMicrophoneMutation>) => {
          if (!AsyncResult.isSuccess(current)) return current;
          const updatedAt = DateTime.nowUnsafe();
          return AsyncResult.success(
            current.value.map((microphone) =>
              applyOptimisticNamedItemEdit(microphone, input.payload, updatedAt),
            ),
          );
        },
        fn: editMicrophoneMutation,
      }),
    );
    const deleteMicrophone = microphones.pipe(
      Atom.optimisticFn({
        reducer: (current, input: MutationInput<typeof deleteMicrophoneMutation>) => {
          if (!AsyncResult.isSuccess(current)) return current;
          return AsyncResult.success(current.value.filter((mic) => mic.id !== input.payload.id));
        },
        fn: deleteMicrophoneMutation,
      }),
    );
    return { microphones, create, edit, delete: deleteMicrophone } as const;
  });

  return { microphoneAtoms } as const;
};
