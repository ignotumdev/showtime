import type { ShowtimeRpcClient } from "../rpc/RpcClient.js";

export const makeLivePresenceAtoms = (RpcClient: ShowtimeRpcClient) => ({
  livePresenceAtoms: {
    heartbeat: RpcClient.mutation("live.heartbeat"),
    release: RpcClient.mutation("live.release"),
  },
});
