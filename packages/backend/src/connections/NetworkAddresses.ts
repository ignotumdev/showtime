import { Context, Effect, Layer } from "effect";
import { networkInterfaces } from "node:os";
import type { ShowtimeConnectionCandidate } from "@showtime/shared";

export class NetworkAddresses extends Context.Service<
  NetworkAddresses,
  {
    readonly candidates: (
      port: number,
      pairingToken: string,
    ) => Effect.Effect<ReadonlyArray<ShowtimeConnectionCandidate>>;
  }
>()("@showtime/backend/connections/NetworkAddresses") {}

const isPrivateIpv4 = (address: string) =>
  address.startsWith("10.") ||
  address.startsWith("192.168.") ||
  /^172\.(1[6-9]|2\d|3[01])\./.test(address);

export const discoverCandidates = (
  interfaces: ReturnType<typeof networkInterfaces>,
  port: number,
  pairingToken: string,
): ReadonlyArray<ShowtimeConnectionCandidate> =>
  Object.entries(interfaces)
    .flatMap(([interfaceName, addresses]) =>
      (addresses ?? [])
        .filter(
          (address) =>
            address.family === "IPv4" &&
            !address.internal &&
            !address.address.startsWith("169.254."),
        )
        .map((address) => ({
          address: address.address,
          interfaceName,
          url: `http://${address.address}:${port}/#pair=${pairingToken}`,
        })),
    )
    .sort((left, right) => {
      const privacy = Number(isPrivateIpv4(right.address)) - Number(isPrivateIpv4(left.address));
      return privacy || left.interfaceName.localeCompare(right.interfaceName);
    });

export const layer = Layer.succeed(
  NetworkAddresses,
  NetworkAddresses.of({
    candidates: (port, pairingToken) =>
      Effect.sync(() => discoverCandidates(networkInterfaces(), port, pairingToken)),
  }),
);
