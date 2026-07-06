import * as React from "react";
import { Cause, Effect, Exit } from "effect";
import { Atom, AtomRegistry, AsyncResult } from "effect/unstable/reactivity";

const scheduleTask = (task: () => void) => {
  const timeout = window.setTimeout(task, 0);
  return () => window.clearTimeout(timeout);
};

const defaultRegistry = AtomRegistry.make({
  scheduleTask,
  defaultIdleTTL: 1_000,
});

const AtomRegistryContext = React.createContext<AtomRegistry.AtomRegistry>(defaultRegistry);

type AtomProviderProps = {
  readonly children: React.ReactNode;
};

export function AtomProvider({ children }: AtomProviderProps) {
  const registryRef = React.useRef<{
    readonly registry: AtomRegistry.AtomRegistry;
    disposalTimeout?: number;
  } | null>(null);

  if (registryRef.current === null) {
    registryRef.current = {
      registry: AtomRegistry.make({
        scheduleTask,
        defaultIdleTTL: 1_000,
      }),
    };
  }

  React.useEffect(() => {
    if (registryRef.current?.disposalTimeout !== undefined) {
      window.clearTimeout(registryRef.current.disposalTimeout);
      registryRef.current.disposalTimeout = undefined;
    }

    return () => {
      const current = registryRef.current;
      if (!current) {
        return;
      }

      current.disposalTimeout = window.setTimeout(() => {
        current.registry.dispose();
        if (registryRef.current === current) {
          registryRef.current = null;
        }
      }, 500);
    };
  }, []);

  return (
    <AtomRegistryContext.Provider value={registryRef.current.registry}>
      {children}
    </AtomRegistryContext.Provider>
  );
}

const storeCache = new WeakMap<
  AtomRegistry.AtomRegistry,
  WeakMap<
    Atom.Atom<unknown>,
    { readonly subscribe: (notify: () => void) => () => void; readonly snapshot: () => unknown }
  >
>();

const makeStore = <A,>(registry: AtomRegistry.AtomRegistry, atom: Atom.Atom<A>) => {
  let registryStores = storeCache.get(registry);
  if (!registryStores) {
    registryStores = new WeakMap();
    storeCache.set(registry, registryStores);
  }

  const cached = registryStores.get(atom as Atom.Atom<unknown>);
  if (cached) {
    return cached as {
      readonly subscribe: (notify: () => void) => () => void;
      readonly snapshot: () => A;
    };
  }

  const store = {
    subscribe: (notify: () => void) => registry.subscribe(atom, notify),
    snapshot: () => registry.get(atom),
  };
  registryStores.set(atom as Atom.Atom<unknown>, store);
  return store;
};

const useRegistry = () => React.useContext(AtomRegistryContext);

const useMountAtom = <A,>(atom: Atom.Atom<A>) => {
  const registry = useRegistry();

  React.useEffect(() => registry.mount(atom), [atom, registry]);
};

export const useAtomValue = <A,>(atom: Atom.Atom<A>): A => {
  const registry = useRegistry();
  const store = React.useMemo(() => makeStore(registry, atom), [atom, registry]);

  return React.useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
};

type AtomSetMode = "value" | "promise" | "promiseExit";

type AtomSetOptions<R, Mode extends AtomSetMode> = {
  readonly mode?: ([R] extends [AsyncResult.AsyncResult<any, any>] ? Mode : "value") | undefined;
};

type AtomSet<R, W, Mode extends AtomSetMode> = Mode extends "promise"
  ? (value: W) => Promise<AsyncResult.AsyncResult.Success<R>>
  : Mode extends "promiseExit"
    ? (
        value: W,
      ) => Promise<
        Exit.Exit<AsyncResult.AsyncResult.Success<R>, AsyncResult.AsyncResult.Failure<R>>
      >
    : (value: W) => void;

const flattenExit = <A, E>(exit: Exit.Exit<A, E>): A => {
  if (Exit.isSuccess(exit)) {
    return exit.value;
  }

  throw Cause.squash(exit.cause);
};

export const useAtomSet = <R, W, Mode extends AtomSetMode = "value">(
  atom: Atom.Writable<R, W>,
  options?: AtomSetOptions<R, Mode>,
): AtomSet<R, W, Mode> => {
  const registry = useRegistry();
  useMountAtom(atom);

  return React.useCallback(
    (value: W) => {
      registry.set(atom, value);

      if (options?.mode === "promise" || options?.mode === "promiseExit") {
        const promise = Effect.runPromiseExit(
          AtomRegistry.getResult(registry, atom as Atom.Atom<AsyncResult.AsyncResult<any, any>>, {
            suspendOnWaiting: true,
          }),
        );

        return options.mode === "promise" ? promise.then(flattenExit) : promise;
      }
    },
    [atom, options?.mode, registry],
  ) as AtomSet<R, W, Mode>;
};

export const useAtom = <R, W>(atom: Atom.Writable<R, W>) =>
  [useAtomValue(atom), useAtomSet(atom)] as const;

export const useAtomRefresh = <A,>(atom: Atom.Atom<A>) => {
  const registry = useRegistry();
  useMountAtom(atom);

  return React.useCallback(() => registry.refresh(atom), [atom, registry]);
};
