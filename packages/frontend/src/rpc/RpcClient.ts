import { Effect, Layer } from "effect";
import { Atom, AtomRpc } from "effect/unstable/reactivity";
import { RpcClient as EffectRpcClient, RpcSerialization } from "effect/unstable/rpc";
import { Socket } from "effect/unstable/socket";
import { ShowtimeRpcs } from "@showtime/contracts";

export interface RpcClientOptions {
  readonly webSocketUrl: string | Effect.Effect<string>;
  readonly webSocketConstructor?: Layer.Layer<Socket.WebSocketConstructor>;
}

/**
 * Showtime's streaming RPCs emit complete snapshots. Keeping earlier chunks would retain
 * every historical snapshot even though consumers only ever expose the newest one.
 */
const latestChunkRuntime = Object.assign(
  ((create: Parameters<Atom.RuntimeFactory>[0]) => {
    const runtime = Atom.runtime(create);
    const pull = runtime.pull.bind(runtime);
    Object.defineProperty(runtime, "pull", {
      value: ((stream, options) =>
        pull(stream, { ...options, disableAccumulation: true })) satisfies typeof runtime.pull,
    });
    return runtime;
  }) as Atom.RuntimeFactory,
  {
    memoMap: Atom.runtime.memoMap,
    addGlobalLayer: Atom.runtime.addGlobalLayer,
    withReactivity: Atom.runtime.withReactivity,
  },
);

export const makeRpcClient = (options: RpcClientOptions) => {
  const socket = Socket.layerWebSocket(options.webSocketUrl).pipe(
    Layer.provide(options.webSocketConstructor ?? Socket.layerWebSocketConstructorGlobal),
  );
  const protocol = EffectRpcClient.layerProtocolSocket({ retryTransientErrors: true }).pipe(
    Layer.provide(socket),
    Layer.provide(RpcSerialization.layerJson),
  );

  return AtomRpc.Service()("@showtime/frontend/RpcClient", {
    group: ShowtimeRpcs,
    protocol,
    runtime: latestChunkRuntime,
  });
};

export type ShowtimeRpcClient = ReturnType<typeof makeRpcClient>;
