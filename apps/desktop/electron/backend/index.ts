import { NodeFileSystem, NodeHttpServer, NodePath } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { HttpRouter } from "effect/unstable/http";
import { RpcSerialization, RpcServer } from "effect/unstable/rpc";
import { createServer } from "node:http";
import { makeRpcPath, rpcHost, rpcPort } from "@showtime/contracts";
import * as Ids from "./ids/Ids";
import * as MicrophoneService from "./microphones/MicrophoneService";
import * as HomeDirectory from "./platform/HomeDirectory";
import * as Rpc from "./rpc/Rpc";
import * as ShowDiscovery from "./shows/ShowDiscovery";
import * as ShowFile from "./shows/ShowFile";
import * as ShowPaths from "./shows/ShowPaths";
import * as ShowRepository from "./shows/ShowRepository";
import * as ShowService from "./shows/ShowService";

const ShowBackendLive = ShowDiscovery.layer.pipe(
  Layer.provideMerge(ShowFile.layer.pipe(Layer.provideMerge(ShowPaths.layer))),
);

const ShowRepositoryLive = ShowRepository.layer.pipe(Layer.provideMerge(ShowBackendLive));

const BackendLive = Layer.mergeAll(Ids.layer, ShowRepositoryLive).pipe(
  Layer.provide(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer, HomeDirectory.layerNode)),
);

const makeRpcProtocol = (token: string) =>
  RpcServer.layerProtocolWebsocket({ path: makeRpcPath(token) as `/${string}` }).pipe(
    Layer.provide(HttpRouter.layer),
  );

const makeRpcLive = (token: string) => {
  const RpcProtocol = makeRpcProtocol(token);

  return Rpc.layer.pipe(
    Layer.provide(Layer.mergeAll(ShowService.layer, MicrophoneService.layer)),
    Layer.provideMerge(RpcProtocol),
    Layer.provide(HttpRouter.serve(RpcProtocol, { disableListenLog: true })),
    Layer.provide(NodeHttpServer.layer(createServer, { host: rpcHost, port: rpcPort })),
    Layer.provide(RpcSerialization.layerJson),
  );
};

const startBackendEffect = Effect.fnUntraced(function* (rpcToken: string, onStarted?: () => void) {
  yield* Effect.logInfo(`Starting Showtime RPC server on ${rpcHost}:${rpcPort}`);
  yield* Effect.scoped(
    Effect.gen(function* () {
      yield* Layer.build(makeRpcLive(rpcToken));
      yield* Effect.sync(() => onStarted?.());
      yield* Effect.never;
    }),
  );
});

export const startBackend = (rpcToken: string, onStarted?: () => void) =>
  startBackendEffect(rpcToken, onStarted).pipe(Effect.provide(BackendLive));
