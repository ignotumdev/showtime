import { NodeFileSystem, NodePath } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import * as Ids from "./ids/Ids";
import * as HomeDirectory from "./platform/HomeDirectory";
import * as ShowDiscovery from "./shows/ShowDiscovery";
import * as ShowFile from "./shows/ShowFile";
import * as ShowPaths from "./shows/ShowPaths";

const ShowBackendLive = ShowDiscovery.layer.pipe(
  Layer.provideMerge(ShowFile.layer.pipe(Layer.provideMerge(ShowPaths.layer))),
);

const BackendLive = Layer.mergeAll(Ids.layer, ShowBackendLive).pipe(
  Layer.provide(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer, HomeDirectory.layerNode)),
);

const startBackendEffect = Effect.fnUntraced(function* () {
  const discovery = yield* ShowDiscovery.ShowDiscovery;
  yield* discovery.discover;
});

export const startBackend = startBackendEffect().pipe(Effect.provide(BackendLive));
