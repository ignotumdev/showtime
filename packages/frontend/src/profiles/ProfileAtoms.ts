import type { ShowtimeRpcClient } from "../rpc/RpcClient.js";
import { latestSnapshot } from "../rpc/LatestSnapshot.js";

export const makeProfileAtoms = (RpcClient: ShowtimeRpcClient) => {
  const state = RpcClient.query("profiles.list", undefined).pipe(latestSnapshot);
  return {
    profileAtoms: {
      state,
      create: RpcClient.mutation("profiles.create"),
      edit: RpcClient.mutation("profiles.edit"),
      delete: RpcClient.mutation("profiles.delete"),
      setDefault: RpcClient.mutation("profiles.setDefault"),
    },
  } as const;
};
