import { Atom } from "effect/unstable/reactivity";
import type { ProfileId, ShowId } from "@showtime/contracts";
import type { ShowtimeRpcClient } from "../rpc/RpcClient.js";
import { latestSnapshot } from "../rpc/LatestSnapshot.js";
import type { StreamingRpcOptions } from "../rpc/StreamingRpcOptions.js";

export const makeChatAtoms = (RpcClient: ShowtimeRpcClient, options?: StreamingRpcOptions) => {
  const createChannel = RpcClient.mutation("chats.createChannel");
  const send = RpcClient.mutation("chats.send");
  const markRead = RpcClient.mutation("chats.markRead");
  const setNotifications = RpcClient.mutation("chats.setNotifications");
  const byShow = Atom.family((showId: ShowId) =>
    Atom.family((profileId: ProfileId) => ({
      state: latestSnapshot(RpcClient.query("chats.state", { showId, profileId }), options),
      createChannel,
      send,
      markRead,
      setNotifications,
    })),
  );
  const chatAtoms = (showId: ShowId, profileId: ProfileId) => byShow(showId)(profileId);
  return { chatAtoms } as const;
};
