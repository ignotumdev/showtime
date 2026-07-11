import { DateTime } from "effect";
import { Atom, AsyncResult } from "effect/unstable/reactivity";
import {
  makeTemporaryId,
  nextMicrophoneNumber,
  microphoneIdPrefix,
  microphonesRpcReactivityKey,
  type Microphone,
  type MicrophoneId,
  type ShowId,
} from "@showtime/contracts";
import { RpcClient } from "@/frontend/rpc/RpcClient";

const createMicrophoneMutation = RpcClient.mutation("CreateMicrophone");
const deleteMicrophoneMutation = RpcClient.mutation("DeleteMicrophone");
export const editMicrophoneAtom = RpcClient.mutation("EditMicrophone").pipe(Atom.keepAlive);

export type MicrophoneListItem = Microphone & { readonly pending?: boolean };

type MutationInput<T> = T extends Atom.AtomResultFn<infer Arg, infer _A, infer _E> ? Arg : never;

const makeTemporaryMicrophoneId = (): MicrophoneId =>
  makeTemporaryId(microphoneIdPrefix) as MicrophoneId;

export const microphoneAtoms = Atom.family((showId: ShowId) => {
  const query = RpcClient.query(
    "ListMicrophones",
    { showId },
    {
      reactivityKeys: microphonesRpcReactivityKey(showId),
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
  const microphones = query.pipe(Atom.optimistic, Atom.keepAlive);
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
    Atom.keepAlive,
  );
  const deleteMicrophone = microphones.pipe(
    Atom.optimisticFn({
      reducer: (current, input: MutationInput<typeof deleteMicrophoneMutation>) => {
        if (!AsyncResult.isSuccess(current)) return current;
        return AsyncResult.success(current.value.filter((mic) => mic.id !== input.payload.id));
      },
      fn: deleteMicrophoneMutation,
    }),
    Atom.keepAlive,
  );
  return { microphones, create, delete: deleteMicrophone } as const;
});
