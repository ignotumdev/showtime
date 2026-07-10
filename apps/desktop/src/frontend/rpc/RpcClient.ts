import { Effect, Layer } from "effect";
import { AtomRpc } from "effect/unstable/reactivity";
import { RpcClient as EffectRpcClient, RpcSerialization } from "effect/unstable/rpc";
import { Socket } from "effect/unstable/socket";
import { RpcGroup } from "@showtime/contracts";

const rpcWebSocketUrl = Effect.promise(() => window.showtime.rpcWebSocketUrl());

const RpcProtocol = EffectRpcClient.layerProtocolSocket().pipe(
  Layer.provide(Socket.layerWebSocket(rpcWebSocketUrl)),
  Layer.provide(Socket.layerWebSocketConstructorGlobal),
  Layer.provide(RpcSerialization.layerJson),
);

export const RpcClient = AtomRpc.Service()("RpcClient", {
  group: RpcGroup,
  protocol: RpcProtocol,
});
