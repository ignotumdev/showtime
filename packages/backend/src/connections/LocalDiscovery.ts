import {
  Context,
  Effect,
  Fiber,
  Layer,
  Path,
  Queue,
  Ref,
  Schema,
  Semaphore,
  SubscriptionRef,
  type Fiber as FiberType,
} from "effect";
import { FileSystem } from "effect/FileSystem";
import { HttpServer } from "effect/unstable/http";
import {
  ShowtimeHostnameLabel,
  type ShowtimeHostnameConnectionCandidate,
  type ShowtimeLocalDiscoveryState,
  showtimeHostnamePairingUrl,
  showtimeLocalHostname,
} from "@showtime/shared";
import * as HomeDirectory from "../platform/HomeDirectory.js";
import { isNotFound, readJson, writeJsonAtomic } from "../persistence/JsonFile.js";
import * as Settings from "../settings/Settings.js";
import { MdnsAdvertiser, type MdnsAdvertisement } from "./MdnsAdvertiser.js";

const DiscoveryFile = Schema.Struct({
  version: Schema.Literal(1),
  hostnameLabel: ShowtimeHostnameLabel,
});

export class LocalDiscovery extends Context.Service<
  LocalDiscovery,
  {
    readonly state: Effect.Effect<ShowtimeLocalDiscoveryState>;
    readonly pairingCandidate: (
      pairingToken: string,
    ) => Effect.Effect<ShowtimeHostnameConnectionCandidate | undefined>;
    readonly setEnabled: (enabled: boolean) => Effect.Effect<void>;
  }
>()("@showtime/backend/connections/LocalDiscovery") {}

export interface LocalDiscoveryOptions {
  readonly port: number;
  readonly runtimeEnabled: boolean;
}

const make = (options: LocalDiscoveryOptions) =>
  Effect.gen(function* () {
    // Requiring the acquired server makes advertisement startup and finalization ordered around TCP.
    yield* HttpServer.HttpServer;
    const scope = yield* Effect.scope;
    const advertiser = yield* MdnsAdvertiser;
    const settings = yield* Settings.Settings;
    const fs = yield* FileSystem;
    const path = yield* Path.Path;
    const home = yield* HomeDirectory.HomeDirectory;
    const directory = path.join(yield* home.homeDirectory, ".showtime");
    const filePath = path.join(directory, "discovery.json");

    const preferredLabel = yield* readJson(fs, filePath, DiscoveryFile).pipe(
      Effect.map((value) => value.hostnameLabel),
      Effect.catchIf(isNotFound, () => Effect.succeed("showtime" as ShowtimeHostnameLabel)),
      Effect.catch((cause) =>
        Effect.gen(function* () {
          const quarantinePath = `${filePath}.corrupt-${Date.now()}`;
          yield* fs.rename(filePath, quarantinePath).pipe(Effect.ignore);
          yield* Effect.logWarning(
            "Ignored an invalid local-address preference; a new one will be saved",
          ).pipe(Effect.annotateLogs("cause", String(cause)));
          return "showtime" as ShowtimeHostnameLabel;
        }),
      ),
    );
    const preference = yield* Ref.make(preferredLabel);
    const currentState = yield* SubscriptionRef.make<ShowtimeLocalDiscoveryState>({
      kind: "disabled",
    });
    const worker = yield* Ref.make<FiberType.Fiber<void, never> | undefined>(undefined);
    const transitionLock = yield* Semaphore.make(1);
    const persistenceQueue = yield* Queue.unbounded<ShowtimeHostnameLabel>();
    const persistenceWarning = yield* Ref.make(false);

    const persist = (hostnameLabel: ShowtimeHostnameLabel): Effect.Effect<void, never> =>
      writeJsonAtomic(fs, directory, filePath, { version: 1 as const, hostnameLabel }).pipe(
        Effect.tap(() => Ref.set(persistenceWarning, false)),
        Effect.catch((cause) =>
          Effect.gen(function* () {
            if (!(yield* Ref.get(persistenceWarning))) {
              yield* Ref.set(persistenceWarning, true);
              yield* Effect.logWarning(
                "Could not save the local address preference; Showtime will retry",
              ).pipe(Effect.annotateLogs("cause", String(cause)));
            }
            yield* Effect.sleep("10 seconds");
            return yield* persist(hostnameLabel);
          }),
        ),
      );
    const persistenceLoop = Effect.forever(
      Queue.take(persistenceQueue).pipe(Effect.flatMap(persist)),
    );
    yield* Effect.forkScoped(persistenceLoop);

    const setState = (state: ShowtimeLocalDiscoveryState) =>
      SubscriptionRef.set(currentState, state);
    const release = (advertisement: MdnsAdvertisement) =>
      advertisement.shutdown.pipe(
        Effect.timeoutOrElse({ duration: "2 seconds", orElse: () => Effect.void }),
      );

    const waitForAdvertiser = (
      advertisement: MdnsAdvertisement,
    ): Effect.Effect<void, import("./MdnsAdvertiser.js").MdnsAdvertiserError> =>
      Effect.suspend(() =>
        advertisement.nextEvent.pipe(
          Effect.flatMap((event) => {
            if (event.kind === "failed") return Effect.fail(event.error);
            return Ref.set(preference, event.hostnameLabel).pipe(
              Effect.andThen(Queue.offer(persistenceQueue, event.hostnameLabel)),
              Effect.andThen(
                setState({
                  kind: "announced",
                  hostname: showtimeLocalHostname(event.hostnameLabel),
                }),
              ),
              Effect.andThen(waitForAdvertiser(advertisement)),
            );
          }),
        ),
      );

    const runAttempt = (attempt: number): Effect.Effect<void, never> =>
      Effect.acquireRelease(
        Ref.get(preference).pipe(
          Effect.flatMap((label) =>
            advertiser.advertise({ preferredLabel: label, port: options.port }),
          ),
        ),
        release,
      ).pipe(
        Effect.flatMap((advertisement) =>
          Ref.set(preference, advertisement.hostnameLabel).pipe(
            Effect.andThen(Queue.offer(persistenceQueue, advertisement.hostnameLabel)),
            Effect.andThen(
              setState({
                kind: "announced",
                hostname: showtimeLocalHostname(advertisement.hostnameLabel),
              }),
            ),
            Effect.tap(() =>
              Effect.logInfo(
                `Easy local address announced as ${showtimeLocalHostname(advertisement.hostnameLabel)}`,
              ),
            ),
            Effect.andThen(waitForAdvertiser(advertisement)),
          ),
        ),
        Effect.scoped,
        Effect.catch((cause) =>
          Effect.gen(function* () {
            yield* setState({ kind: "degraded", reason: "network-unavailable" });
            if (attempt === 0) {
              yield* Effect.logWarning(
                "Easy local address is unavailable; using IP addresses",
              ).pipe(Effect.annotateLogs("operation", cause.operation));
            }
            const cappedMilliseconds = Math.min(30_000, 1_000 * 2 ** Math.min(attempt, 5));
            const jitter = yield* Effect.sync(() => Math.floor(Math.random() * 250));
            yield* Effect.sleep(`${cappedMilliseconds + jitter} millis`);
            yield* setState({ kind: "probing" });
            return yield* runAttempt(attempt + 1);
          }),
        ),
      );

    const setEnabled = (enabled: boolean) =>
      transitionLock.withPermits(1)(
        Effect.gen(function* () {
          const running = yield* Ref.get(worker);
          const shouldRun = options.runtimeEnabled && enabled;
          if (shouldRun && running === undefined) {
            yield* setState({ kind: "probing" });
            const fiber = yield* Effect.forkIn(runAttempt(0), scope);
            yield* Ref.set(worker, fiber);
          } else if (!shouldRun && running !== undefined) {
            yield* Fiber.interrupt(running);
            yield* Ref.set(worker, undefined);
            yield* setState({ kind: "disabled" });
          } else if (!shouldRun) {
            yield* setState({ kind: "disabled" });
          }
        }),
      );

    yield* setEnabled((yield* settings.get).connectionsEnabled);

    return LocalDiscovery.of({
      state: SubscriptionRef.get(currentState),
      pairingCandidate: (pairingToken) =>
        SubscriptionRef.get(currentState).pipe(
          Effect.map((state) => {
            if (state.kind !== "announced") return undefined;
            const hostnameLabel = Schema.decodeUnknownSync(ShowtimeHostnameLabel)(
              state.hostname.replace(/\.local$/i, ""),
            );
            return {
              kind: "hostname" as const,
              label: "Showtime local address",
              host: state.hostname,
              hostnameLabel,
              url: showtimeHostnamePairingUrl(hostnameLabel, pairingToken, options.port),
            };
          }),
        ),
      setEnabled,
    });
  });

export const layer = (options: LocalDiscoveryOptions) =>
  Layer.effect(LocalDiscovery, make(options));
