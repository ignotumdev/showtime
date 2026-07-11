import { NodeFileSystem, NodeHttpServer, NodePath } from "@effect/platform-node";
import { Layer, ManagedRuntime } from "effect";
import { HttpRouter } from "effect/unstable/http";
import { RpcSerialization, RpcServer } from "effect/unstable/rpc";
import { createServer } from "node:http";
import * as Ids from "./ids/Ids.js";
import * as MicrophoneService from "./microphones/MicrophoneService.js";
import * as MixService from "./mixes/MixService.js";
import * as HomeDirectory from "./platform/HomeDirectory.js";
import * as Rpc from "./rpc/Rpc.js";
import * as ShowDiscovery from "./shows/ShowDiscovery.js";
import * as ShowFile from "./shows/ShowFile.js";
import * as ShowPaths from "./shows/ShowPaths.js";
import * as ShowRepository from "./shows/ShowRepository.js";
import * as ShowService from "./shows/ShowService.js";
import * as SongService from "./songs/SongService.js";

const ShowBackendLive = ShowDiscovery.layer.pipe(
  Layer.provideMerge(ShowFile.layer.pipe(Layer.provideMerge(ShowPaths.layer))),
);

const ShowRepositoryLive = ShowRepository.layer.pipe(Layer.provideMerge(ShowBackendLive));

export interface BackendOptions {
  readonly host: string;
  readonly port: number;
  readonly rpcPath: `/${string}`;
  readonly homeDirectory?: string;
}

const makeBackendServices = (options: BackendOptions) =>
  Layer.mergeAll(Ids.layer, ShowRepositoryLive).pipe(
    Layer.provide(
      Layer.mergeAll(
        NodeFileSystem.layer,
        NodePath.layer,
        options.homeDirectory === undefined
          ? HomeDirectory.layerNode
          : HomeDirectory.makeLayer(options.homeDirectory),
      ),
    ),
  );

const makeRpcProtocol = (path: `/${string}`) =>
  RpcServer.layerProtocolWebsocket({ path }).pipe(Layer.provide(HttpRouter.layer));

const makeRpcLive = (options: BackendOptions) => {
  const RpcProtocol = makeRpcProtocol(options.rpcPath);

  return Rpc.layer.pipe(
    Layer.provide(
      Layer.mergeAll(
        ShowService.layer,
        MicrophoneService.layer,
        MixService.layer,
        SongService.layer,
      ),
    ),
    Layer.provideMerge(RpcProtocol),
    Layer.provide(HttpRouter.serve(RpcProtocol, { disableListenLog: true })),
    Layer.provide(NodeHttpServer.layer(createServer, { host: options.host, port: options.port })),
    Layer.provide(RpcSerialization.layerJson),
  );
};

export const makeBackendLayer = (options: BackendOptions) =>
  makeRpcLive(options).pipe(Layer.provide(makeBackendServices(options)));

export const makeBackendRuntime = (options: BackendOptions) =>
  ManagedRuntime.make(makeBackendLayer(options));
