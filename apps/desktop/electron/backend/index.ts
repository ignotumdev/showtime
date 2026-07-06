import { NodeFileSystem, NodeHttpServer, NodePath } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { HttpRouter } from "effect/unstable/http";
import { RpcSerialization, RpcServer } from "effect/unstable/rpc";
import { createServer } from "node:http";
import { makeShowRpcPath, showRpcHost, showRpcPort } from "@showtime/contracts";
import * as Ids from "./ids/Ids";
import * as HomeDirectory from "./platform/HomeDirectory";
import * as ShowDiscovery from "./shows/ShowDiscovery";
import * as ShowFile from "./shows/ShowFile";
import * as ShowPaths from "./shows/ShowPaths";
import * as ShowRpc from "./shows/ShowRpc";
import * as ShowService from "./shows/ShowService";

const ShowBackendLive = ShowDiscovery.layer.pipe(
  Layer.provideMerge(ShowFile.layer.pipe(Layer.provideMerge(ShowPaths.layer))),
);

const BackendLive = Layer.mergeAll(Ids.layer, ShowBackendLive).pipe(
  Layer.provide(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer, HomeDirectory.layerNode)),
);

const makeShowRpcProtocol = (token: string) =>
  RpcServer.layerProtocolWebsocket({ path: makeShowRpcPath(token) as `/${string}` }).pipe(
    Layer.provide(HttpRouter.layer),
  );

const makeShowRpcLive = (token: string) => {
  const ShowRpcProtocol = makeShowRpcProtocol(token);

  return ShowRpc.layer.pipe(
    Layer.provide(ShowService.layer),
    Layer.provideMerge(ShowRpcProtocol),
    Layer.provide(HttpRouter.serve(ShowRpcProtocol, { disableListenLog: true })),
    Layer.provide(NodeHttpServer.layer(createServer, { host: showRpcHost, port: showRpcPort })),
    Layer.provide(RpcSerialization.layerJson),
  );
};

const startBackendEffect = Effect.fnUntraced(function* (rpcToken: string, onStarted?: () => void) {
  const discovery = yield* ShowDiscovery.ShowDiscovery;
  yield* discovery.discover;
  yield* Effect.logInfo(`Starting Showtime RPC server on ${showRpcHost}:${showRpcPort}`);
  yield* Effect.scoped(
    Effect.gen(function* () {
      yield* Layer.build(makeShowRpcLive(rpcToken));
      yield* Effect.sync(() => onStarted?.());
      yield* Effect.never;
    }),
  );
});

export const startBackend = (rpcToken: string, onStarted?: () => void) =>
  startBackendEffect(rpcToken, onStarted).pipe(Effect.provide(BackendLive));
