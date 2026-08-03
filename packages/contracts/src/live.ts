import { Schema } from "effect";

export const LiveSessionId = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(128));
export type LiveSessionId = typeof LiveSessionId.Type;
