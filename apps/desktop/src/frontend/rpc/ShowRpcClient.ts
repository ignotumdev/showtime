import { Layer } from "effect";
import { AtomRpc } from "effect/unstable/reactivity";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";
import { Socket } from "effect/unstable/socket";
import { ShowRpcGroup, showRpcWebSocketUrl } from "@showtime/contracts";

const ShowRpcProtocol = RpcClient.layerProtocolSocket().pipe(
  Layer.provide(Socket.layerWebSocket(showRpcWebSocketUrl)),
  Layer.provide(Socket.layerWebSocketConstructorGlobal),
  Layer.provide(RpcSerialization.layerJson),
);

export const ShowRpcClient = AtomRpc.Service()("ShowRpcClient", {
  group: ShowRpcGroup,
  protocol: ShowRpcProtocol,
});
