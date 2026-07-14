import { NodeFileSystem, NodeHttpServer, NodePath } from "@effect/platform-node";
import { Context, Effect, Layer, ManagedRuntime, Semaphore } from "effect";
import { HttpRouter, HttpServerResponse, HttpStaticServer } from "effect/unstable/http";
import { RpcSerialization, RpcServer } from "effect/unstable/rpc";
import { createServer } from "node:http";
import { showtimeLocalPort, type ShowtimeConnectionInfo } from "@showtime/shared";
import { randomBytes } from "node:crypto";
import * as ConnectionStore from "./connections/ConnectionStore.js";
import * as NetworkAddresses from "./connections/NetworkAddresses.js";
import * as LocalDiscovery from "./connections/LocalDiscovery.js";
import * as MdnsAdvertiserLive from "./connections/MdnsAdvertiserLive.js";
import type * as MdnsAdvertiser from "./connections/MdnsAdvertiser.js";
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
import * as ProfileService from "./profiles/ProfileService.js";

const ShowBackendLive = ShowDiscovery.layer.pipe(
  Layer.provideMerge(ShowFile.layer.pipe(Layer.provideMerge(ShowPaths.layer))),
);

const ShowRepositoryLive = ShowRepository.layer.pipe(Layer.provideMerge(ShowBackendLive));
const ProfileLive = ProfileService.layer.pipe(Layer.provideMerge(Ids.layer));

export interface BackendOptions {
  readonly host: string;
  readonly port: number;
  readonly webRoot?: string;
  readonly homeDirectory?: string;
  /** Defaults to enabled for the canonical production port and disabled for test overrides. */
  readonly localDiscovery?: boolean;
}

const rpcWebSocketHost = (host: string) => {
  if (host === "0.0.0.0") return "127.0.0.1";
  if (host === "::") return "[::1]";
  return host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
};

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

const makeBackendServices = () => Layer.mergeAll(Ids.layer, ShowRepositoryLive, ProfileLive);

const makePlatformLayer = (options: BackendOptions) =>
  Layer.mergeAll(
    NodeFileSystem.layer,
    NodePath.layer,
    options.homeDirectory === undefined
      ? HomeDirectory.layerNode
      : HomeDirectory.makeLayer(options.homeDirectory),
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
          if (!params.clientId || !params.capability) return yield* notFound;
          return (
            (yield* connections.withAuthorizedSession(
              params.clientId,
              params.capability,
              settings.get.pipe(Effect.map((value) => value.connectionsEnabled)),
              httpEffect,
            )) ?? (yield* notFound)
          );
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
      yield* router.add(
        "GET",
        "/connection-status/:clientId/:capability",
        Effect.gen(function* () {
          const params = yield* HttpRouter.params;
          if (!params.clientId || !params.capability) return yield* notFound;
          const credentialStatus = yield* connections.credentialsStatus(
            params.clientId,
            params.capability,
          );
          if (credentialStatus === "revoked") {
            return HttpServerResponse.jsonUnsafe({ status: "revoked" }, { status: 401 });
          }
          if (!(yield* settings.get).connectionsEnabled) {
            return HttpServerResponse.jsonUnsafe({ status: "disabled" }, { status: 503 });
          }
          return HttpServerResponse.jsonUnsafe({ status: "available" });
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
      const discovery = yield* LocalDiscovery.LocalDiscovery;
      const connectionTransition = yield* Semaphore.make(1);
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
          `ws://${rpcWebSocketHost(options.host)}:${options.port}/rpc/desktop/${desktopCapability}`,
        ),
        connectionsState: state,
        createInvitation: (name) => connections.createInvitation(name).pipe(Effect.andThen(state)),
        pairingInfo: (invitationId) =>
          connections.pairingInvitation(invitationId).pipe(
            Effect.flatMap((invitation): Effect.Effect<ShowtimeConnectionInfo> => {
              if (!invitation) {
                return Effect.succeed({
                  discovery: { kind: "disabled" },
                  candidates: [],
                  expiresAt: null,
                });
              }
              return Effect.all(
                {
                  discovery: discovery.state,
                  hostname: discovery.pairingCandidate(invitation.token),
                  ipAddresses: addresses.candidates(options.port, invitation.token),
                },
                { concurrency: "unbounded" },
              ).pipe(
                Effect.map(({ discovery: discoveryState, hostname, ipAddresses }) => ({
                  discovery:
                    hostname === undefined
                      ? discoveryState
                      : ({ kind: "announced", hostname: hostname.host } as const),
                  candidates: hostname === undefined ? ipAddresses : [hostname, ...ipAddresses],
                  expiresAt: invitation.expiresAt,
                })),
              );
            }),
          ),
        removeConnection: (id) => connections.remove(id).pipe(Effect.andThen(state)),
        setConnectionsEnabled: (enabled) =>
          connectionTransition.withPermits(1)(
            settings.setConnectionsEnabled(enabled).pipe(
              Effect.andThen(enabled ? Effect.void : connections.disconnectAll),
              Effect.andThen(discovery.setEnabled(enabled)),
              Effect.tap(() =>
                Effect.logInfo(
                  enabled ? "Enabled remote connections" : "Disabled remote connections",
                ),
              ),
              Effect.andThen(state),
            ),
          ),
      });
    }),
  );

const makeConnectionLayers = () =>
  Layer.mergeAll(ConnectionStore.layer, Settings.layer, NetworkAddresses.layer);

export const makeBackendLayer = (
  options: BackendOptions,
  mdnsAdvertiserLayer: Layer.Layer<MdnsAdvertiser.MdnsAdvertiser> = MdnsAdvertiserLive.layer,
) => {
  const desktopCapability = randomBytes(32).toString("base64url");
  const HttpServerLive = NodeHttpServer.layer(createServer, {
    host: options.host,
    port: options.port,
  });
  const LocalDiscoveryLive = LocalDiscovery.layer({
    port: options.port,
    runtimeEnabled: options.localDiscovery ?? options.port === showtimeLocalPort,
  }).pipe(Layer.provide(mdnsAdvertiserLayer));
  return Layer.mergeAll(
    makeServerLive(options, desktopCapability),
    makeConnectionManagerLayer(options, desktopCapability).pipe(
      Layer.provideMerge(LocalDiscoveryLive),
    ),
  ).pipe(
    Layer.provideMerge(HttpServerLive),
    Layer.provideMerge(makeConnectionLayers()),
    Layer.provideMerge(makeBackendServices()),
    Layer.provide(makePlatformLayer(options)),
  );
};

export const makeBackendRuntime = (
  options: BackendOptions,
  mdnsAdvertiserLayer?: Layer.Layer<MdnsAdvertiser.MdnsAdvertiser>,
) => ManagedRuntime.make(makeBackendLayer(options, mdnsAdvertiserLayer));
