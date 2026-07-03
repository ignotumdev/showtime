import { Atom, AsyncResult } from "effect/unstable/reactivity";
import {
  idAlphabet,
  idSuffixLength,
  showIdPrefix,
  showRpcReactivityKey,
  type ShowColor,
  type ShowId,
  type ShowSummary,
} from "@showtime/contracts";
import { ShowRpcClient } from "@/frontend/rpc/ShowRpcClient";

export type ShowDialogState =
  | { readonly type: "closed" }
  | { readonly type: "create" }
  | { readonly type: "edit"; readonly show: ShowSummary }
  | { readonly type: "delete"; readonly show: ShowSummary };

export const showDialogAtom = Atom.make<ShowDialogState>({ type: "closed" }).pipe(Atom.keepAlive);

const makeTemporaryShowId = (): ShowId => {
  const suffix = Array.from(
    { length: idSuffixLength },
    () => idAlphabet[Math.floor(Math.random() * idAlphabet.length)],
  ).join("");

  return `${showIdPrefix}${suffix}` as ShowId;
};

const sortShows = (shows: ReadonlyArray<ShowSummary>) =>
  [...shows].sort((left, right) =>
    `${left.name.toLocaleLowerCase()}:${left.id}`.localeCompare(
      `${right.name.toLocaleLowerCase()}:${right.id}`,
    ),
  );

const optimisticShowName = (name: string): ShowSummary["name"] => name as ShowSummary["name"];

const optimisticShowColor = (color: ShowColor): ShowSummary["color"] => color;

const showsQueryAtom = ShowRpcClient.query("ListShows", undefined, {
  reactivityKeys: showRpcReactivityKey,
  serializationKey: "all",
  timeToLive: "5 minutes",
}).pipe(
  Atom.swr({
    staleTime: 10_000,
    revalidateOnMount: true,
    revalidateOnFocus: true,
    focusSignal: Atom.windowFocusSignal,
  }),
  Atom.keepAlive,
);

export const showsAtom = showsQueryAtom.pipe(Atom.optimistic, Atom.keepAlive);

const createShowMutation = ShowRpcClient.mutation("CreateShow");
const editShowMutation = ShowRpcClient.mutation("EditShow");
const deleteShowMutation = ShowRpcClient.mutation("DeleteShow");

type MutationInput<T> = T extends Atom.AtomResultFn<infer Arg, infer _A, infer _E> ? Arg : never;

export const createShowAtom = showsAtom.pipe(
  Atom.optimisticFn({
    reducer: (current, input: MutationInput<typeof createShowMutation>) => {
      if (!AsyncResult.isSuccess(current)) {
        return current;
      }

      const now = new Date().toISOString();
      return AsyncResult.success(
        sortShows([
          ...current.value,
          {
            id: makeTemporaryShowId(),
            name: optimisticShowName(input.payload.name.trim()),
            color: optimisticShowColor(input.payload.color),
            createdAt: now,
            updatedAt: now,
          },
        ]),
      );
    },
    fn: createShowMutation,
  }),
  Atom.keepAlive,
);

export const editShowAtom = showsAtom.pipe(
  Atom.optimisticFn({
    reducer: (current, input: MutationInput<typeof editShowMutation>) => {
      if (!AsyncResult.isSuccess(current)) {
        return current;
      }

      return AsyncResult.success(
        sortShows(
          current.value.map((show) =>
            show.id === input.payload.id
              ? {
                  ...show,
                  name: optimisticShowName(input.payload.name.trim()),
                  color: optimisticShowColor(input.payload.color),
                  updatedAt: new Date().toISOString(),
                }
              : show,
          ),
        ),
      );
    },
    fn: editShowMutation,
  }),
  Atom.keepAlive,
);

export const deleteShowAtom = showsAtom.pipe(
  Atom.optimisticFn({
    reducer: (current, input: MutationInput<typeof deleteShowMutation>) => {
      if (!AsyncResult.isSuccess(current)) {
        return current;
      }

      return AsyncResult.success(current.value.filter((show) => show.id !== input.payload.id));
    },
    fn: deleteShowMutation,
  }),
  Atom.keepAlive,
);

export const showMutationOptions = {
  reactivityKeys: showRpcReactivityKey,
} as const;
