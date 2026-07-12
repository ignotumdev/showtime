import { NodeFileSystem, NodeHttpServer, NodePath } from "@effect/platform-node";
import { Context, Effect, Layer, ManagedRuntime } from "effect";
import { HttpRouter, HttpServerResponse, HttpStaticServer } from "effect/unstable/http";
import { RpcSerialization, RpcServer } from "effect/unstable/rpc";
import { createServer } from "node:http";
import type { ShowtimeConnectionInfo } from "@showtime/shared";
import { randomBytes } from "node:crypto";
import * as ConnectionStore from "./connections/ConnectionStore.js";
import * as NetworkAddresses from "./connections/NetworkAddresses.js";
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
import * as SyncEngine from "./sync/SyncEngine.js";
import * as Settings from "./settings/Settings.js";

const ShowBackendLive = ShowDiscovery.layer.pipe(
  Layer.provideMerge(ShowFile.layer.pipe(Layer.provideMerge(ShowPaths.layer))),
);

const ShowRepositoryLive = ShowRepository.layer.pipe(Layer.provideMerge(ShowBackendLive));

export interface BackendOptions {
  readonly host: string;
  readonly port: number;
  readonly webRoot?: string;
  readonly homeDirectory?: string;
}

export class ConnectionManager extends Context.Service<
  ConnectionManager,
  {
    readonly rpcWebSocketUrl: Effect.Effect<string>;
    readonly connectionsState: Effect.Effect<import("@showtime/shared").ShowtimeConnectionsState>;
    readonly createInvitation: (
      name: string,
    ) => Effect.Effect<import("@showtime/shared").ShowtimeConnectionsState>;
    readonly pairingInfo: (invitationId: string) => Effect.Effect<ShowtimeConnectionInfo>;
    readonly removeConnection: (
      id: string,
    ) => Effect.Effect<import("@showtime/shared").ShowtimeConnectionsState>;
    readonly setConnectionsEnabled: (
      enabled: boolean,
    ) => Effect.Effect<import("@showtime/shared").ShowtimeConnectionsState>;
  }
>()("@showtime/backend/ConnectionManager") {}

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

const makeRpcProtocol = (desktopCapability: string) =>
  Layer.effect(
    RpcServer.Protocol,
    Effect.gen(function* () {
      const { httpEffect, protocol } = yield* RpcServer.makeProtocolWithHttpEffectWebsocket;
      const router = yield* HttpRouter.HttpRouter;
      const connections = yield* ConnectionStore.ConnectionStore;
      const settings = yield* Settings.Settings;
      const notFound = Effect.succeed(HttpServerResponse.empty({ status: 404 }));
      yield* router.add(
        "GET",
        "/rpc/:clientId/:capability",
        Effect.gen(function* () {
          const params = yield* HttpRouter.params;
          if (params.clientId === "desktop" && params.capability === desktopCapability)
            return yield* httpEffect;
          const enabled = (yield* settings.get).connectionsEnabled;
          if (!enabled || !params.clientId || !params.capability) return yield* notFound;
          return (yield* connections.authorize(params.clientId, params.capability))
            ? yield* connections.withSession(params.clientId, httpEffect)
            : yield* notFound;
        }),
      );
      yield* router.add(
        "POST",
        "/pair/:token",
        Effect.gen(function* () {
          const params = yield* HttpRouter.params;
          if (!(yield* settings.get).connectionsEnabled || !params.token) return yield* notFound;
          const credentials = yield* connections.consumeInvitation(params.token);
          return credentials
            ? HttpServerResponse.jsonUnsafe({ version: 1 as const, ...credentials })
            : HttpServerResponse.jsonUnsafe(
                { error: "This connection link is invalid, expired, or has already been used." },
                { status: 410 },
              );
        }),
      );
      return protocol;
    }),
  ).pipe(Layer.provide(HttpRouter.layer));

const makeServerLive = (options: BackendOptions, desktopCapability: string) =>
  (() => {
    const RpcProtocol = makeRpcProtocol(desktopCapability);
    const staticFiles =
      options.webRoot === undefined
        ? Layer.empty
        : HttpStaticServer.layer({
            root: options.webRoot,
            index: "index.html",
            spa: true,
            cacheControl: "no-cache",
          });

    const remoteHostingGate = HttpRouter.middleware()(
      Effect.gen(function* () {
        const settings = yield* Settings.Settings;
        return (httpEffect) =>
          settings.get.pipe(
            Effect.flatMap((value) =>
              value.connectionsEnabled
                ? httpEffect
                : Effect.succeed(HttpServerResponse.empty({ status: 404 })),
            ),
          );
      }),
    ).layer;

    return Rpc.layer.pipe(
      Layer.provide(
        Layer.mergeAll(
          ShowService.layer,
          MicrophoneService.layer,
          MixService.layer,
          SongService.layer,
          SyncEngine.layer,
        ),
      ),
      Layer.provideMerge(RpcProtocol),
      Layer.provide(
        HttpRouter.serve(
          Layer.mergeAll(RpcProtocol, staticFiles.pipe(Layer.provide(remoteHostingGate))),
          {
            disableListenLog: true,
          },
        ),
      ),
      Layer.provide(NodeHttpServer.layer(createServer, { host: options.host, port: options.port })),
      Layer.provide(RpcSerialization.layerJson),
    );
  })();

const makeConnectionManagerLayer = (options: BackendOptions, desktopCapability: string) =>
  Layer.effect(
    ConnectionManager,
    Effect.gen(function* () {
      const connections = yield* ConnectionStore.ConnectionStore;
      const settings = yield* Settings.Settings;
      const addresses = yield* NetworkAddresses.NetworkAddresses;
      const state = Effect.all({
        settings: settings.get,
        clients: connections.clients,
        invitations: connections.invitations,
        connectedClientIds: connections.connectedClientIds,
      }).pipe(
        Effect.map(({ settings, clients, invitations, connectedClientIds }) => ({
          enabled: settings.connectionsEnabled,
          clients: [
            ...invitations.map(({ invitationId, name, expiresAt }) => ({
              kind: "pending" as const,
              invitationId,
              name,
              expiresAt,
            })),
            ...clients.map(({ clientId, name, createdAt }) => ({
              kind: "paired" as const,
              clientId,
              name,
              createdAt,
              connected: connectedClientIds.has(clientId),
            })),
          ],
        })),
      );
      return ConnectionManager.of({
        rpcWebSocketUrl: Effect.succeed(
          `ws://127.0.0.1:${options.port}/rpc/desktop/${desktopCapability}`,
        ),
        connectionsState: state,
        createInvitation: (name) => connections.createInvitation(name).pipe(Effect.andThen(state)),
        pairingInfo: (invitationId) =>
          connections.pairingInvitation(invitationId).pipe(
            Effect.flatMap((invitation) =>
              invitation
                ? addresses.candidates(options.port, invitation.token)
                : Effect.succeed([]),
            ),
            Effect.map((candidates) => ({ candidates })),
          ),
        removeConnection: (id) => connections.remove(id).pipe(Effect.andThen(state)),
        setConnectionsEnabled: (enabled) =>
          settings.setConnectionsEnabled(enabled).pipe(
            Effect.andThen(enabled ? Effect.void : connections.disconnectAll),
            Effect.tap(() =>
              Effect.logInfo(
                enabled ? "Enabled remote connections" : "Disabled remote connections",
              ),
            ),
            Effect.andThen(state),
          ),
      });
    }),
  );

const makeConnectionLayers = (options: BackendOptions) =>
  Layer.mergeAll(ConnectionStore.layer, Settings.layer, NetworkAddresses.layer).pipe(
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

export const makeBackendLayer = (options: BackendOptions) => {
  const desktopCapability = randomBytes(32).toString("base64url");
  return Layer.mergeAll(
    makeServerLive(options, desktopCapability),
    makeConnectionManagerLayer(options, desktopCapability),
  ).pipe(
    Layer.provideMerge(makeConnectionLayers(options)),
    Layer.provide(makeBackendServices(options)),
  );
};

export const makeBackendRuntime = (options: BackendOptions) =>
  ManagedRuntime.make(makeBackendLayer(options));
