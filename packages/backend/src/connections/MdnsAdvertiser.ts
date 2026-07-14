import { Context, Data, Effect, Layer } from "effect";
import type { ShowtimeHostnameLabel } from "@showtime/shared";

export class MdnsAdvertiserError extends Data.TaggedError("MdnsAdvertiserError")<{
  readonly operation: "start" | "advertise" | "republish" | "shutdown";
  readonly cause: unknown;
}> {}

export type MdnsAdvertiserEvent =
  | { readonly kind: "hostname-changed"; readonly hostnameLabel: ShowtimeHostnameLabel }
  | { readonly kind: "failed"; readonly error: MdnsAdvertiserError };

export interface MdnsAdvertisement {
  readonly hostnameLabel: ShowtimeHostnameLabel;
  readonly nextEvent: Effect.Effect<MdnsAdvertiserEvent>;
  readonly shutdown: Effect.Effect<void>;
}

export class MdnsAdvertiser extends Context.Service<
  MdnsAdvertiser,
  {
    readonly advertise: (options: {
      readonly preferredLabel: ShowtimeHostnameLabel;
      readonly port: number;
    }) => Effect.Effect<MdnsAdvertisement, MdnsAdvertiserError>;
  }
>()("@showtime/backend/connections/MdnsAdvertiser") {}

export const makeLayer = (
  advertise: (options: {
    readonly preferredLabel: ShowtimeHostnameLabel;
    readonly port: number;
  }) => Effect.Effect<MdnsAdvertisement, MdnsAdvertiserError>,
) => Layer.succeed(MdnsAdvertiser, MdnsAdvertiser.of({ advertise }));
