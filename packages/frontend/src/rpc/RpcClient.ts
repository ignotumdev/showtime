import { Effect, Layer } from "effect";
import { AtomRpc } from "effect/unstable/reactivity";
import { RpcClient as EffectRpcClient, RpcSerialization } from "effect/unstable/rpc";
import { Socket } from "effect/unstable/socket";
import { ShowtimeRpcs } from "@showtime/contracts";

export interface RpcClientOptions {
  readonly webSocketUrl: string | Effect.Effect<string>;
  readonly webSocketConstructor?: Layer.Layer<Socket.WebSocketConstructor>;
}

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
  });
};

export type ShowtimeRpcClient = ReturnType<typeof makeRpcClient>;
