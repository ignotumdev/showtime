import { Effect, Queue, Schema } from "effect";
import { getResponder, ServiceType, type CiaoService } from "@homebridge/ciao";
import { ShowtimeHostnameLabel } from "@showtime/shared";
import { networkInterfaces } from "node:os";
import { MdnsAdvertiser, MdnsAdvertiserError, type MdnsAdvertiserEvent } from "./MdnsAdvertiser.js";
import { Layer } from "effect";

type PatchedCiaoService = CiaoService & {
  on(event: "republish-error", listener: (error: Error) => void): PatchedCiaoService;
  off(event: "republish-error", listener: (error: Error) => void): PatchedCiaoService;
};

const hostnameLabel = (hostname: string) =>
  Schema.decodeUnknownSync(ShowtimeHostnameLabel)(hostname.replace(/\.local\.?$/i, ""));

const make = MdnsAdvertiser.of({
  advertise: ({ preferredLabel, port }) =>
    Effect.gen(function* () {
      const events = yield* Queue.unbounded<MdnsAdvertiserEvent>();
      const resource = yield* Effect.try({
        try: () => {
          const hasLanIpv4 = Object.values(networkInterfaces()).some((addresses) =>
            (addresses ?? []).some((address) => address.family === "IPv4" && !address.internal),
          );
          if (!hasLanIpv4) throw new Error("No local IPv4 network interface is available");
          const responder = getResponder();
          const service = responder.createService({
            // Keep the DNS-SD service instance unique for the same reason as the host label.
            // Otherwise two intentionally different Showtime hosts still conflict on "Showtime".
            name: preferredLabel,
            type: ServiceType.HTTP,
            hostname: preferredLabel,
            fixedName: true,
            port,
            disabledIpv6: true,
            txt: {},
          }) as PatchedCiaoService;
          return { responder, service };
        },
        catch: (cause) => new MdnsAdvertiserError({ operation: "start", cause }),
      });
      const { responder, service } = resource;
      const onNameChange = () => undefined;
      const onHostnameChange = (value: string) => {
        try {
          Queue.offerUnsafe(events, {
            kind: "hostname-changed",
            hostnameLabel: hostnameLabel(value),
          });
        } catch (cause) {
          Queue.offerUnsafe(events, {
            kind: "failed",
            error: new MdnsAdvertiserError({ operation: "republish", cause }),
          });
        }
      };
      const onRepublishError = (cause: Error) =>
        Queue.offerUnsafe(events, {
          kind: "failed",
          error: new MdnsAdvertiserError({ operation: "republish", cause }),
        });
      service.on("name-change", onNameChange);
      service.on("hostname-change", onHostnameChange);
      service.on("republish-error", onRepublishError);

      let shutdownPromise: Promise<void> | undefined;
      const shutdown = Effect.tryPromise({
        try: () => {
          shutdownPromise ??= (async () => {
            service.off("name-change", onNameChange);
            service.off("hostname-change", onHostnameChange);
            service.off("republish-error", onRepublishError);
            try {
              await service.destroy();
            } finally {
              await responder.shutdown();
            }
          })();
          return shutdownPromise;
        },
        catch: (cause) => new MdnsAdvertiserError({ operation: "shutdown", cause }),
      }).pipe(Effect.ignore);

      yield* Effect.tryPromise({
        try: () => service.advertise(),
        catch: (cause) => new MdnsAdvertiserError({ operation: "advertise", cause }),
      }).pipe(
        Effect.timeoutOrElse({
          duration: "5 seconds",
          orElse: () =>
            Effect.fail(
              new MdnsAdvertiserError({
                operation: "advertise",
                cause: new Error("mDNS probing timed out"),
              }),
            ),
        }),
        Effect.tapError(() => shutdown),
      );

      const announcedLabel = yield* Effect.try({
        try: () => hostnameLabel(service.getHostname()),
        catch: (cause) => new MdnsAdvertiserError({ operation: "advertise", cause }),
      }).pipe(Effect.tapError(() => shutdown));

      return {
        hostnameLabel: announcedLabel,
        nextEvent: Queue.take(events),
        shutdown,
      };
    }),
});

export const layer = Layer.succeed(MdnsAdvertiser, make);
