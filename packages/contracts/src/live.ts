import { Schema } from "effect";

export const liveHeartbeatIntervalMs = 5_000;
export const liveLeaseLifetimeMs = liveHeartbeatIntervalMs * 4;

export const LiveSessionId = Schema.String.pipe(
  Schema.check(Schema.isMinLength(1), Schema.isMaxLength(128)),
  Schema.brand("LiveSessionId"),
);
export type LiveSessionId = typeof LiveSessionId.Type;
