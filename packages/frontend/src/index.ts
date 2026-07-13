import { makeMicrophoneAtoms } from "./microphones/MicrophoneAtoms.js";
import { makeMixAtoms } from "./mixes/MixAtoms.js";
import { makeRpcClient, type RpcClientOptions } from "./rpc/RpcClient.js";
import { makeShowAtoms } from "./shows/ShowAtoms.js";
import { makeSongAtoms } from "./songs/SongAtoms.js";
import type { StreamingRpcOptions } from "./rpc/StreamingRpcOptions.js";

export interface ShowtimeFrontendOptions extends RpcClientOptions, StreamingRpcOptions {}

export const makeShowtimeFrontend = (options: ShowtimeFrontendOptions) => {
  const RpcClient = makeRpcClient(options);
  const atomOptions = { refreshSignals: options.refreshSignals };

  return {
    RpcClient,
    ...makeShowAtoms(RpcClient, atomOptions),
    ...makeMicrophoneAtoms(RpcClient, atomOptions),
    ...makeMixAtoms(RpcClient, atomOptions),
    ...makeSongAtoms(RpcClient, atomOptions),
  } as const;
};

export * from "./live/LiveSongView.js";
export * from "./microphones/MicrophoneAtoms.js";
export * from "./mixes/MixAtoms.js";
export * from "./react/AsyncResult.js";
export * from "./rpc/errors.js";
export * from "./rpc/LatestSnapshot.js";
export * from "./rpc/Reactivity.js";
export * from "./rpc/RpcClient.js";
export * from "./rpc/StreamingRpcOptions.js";
export * from "./shows/ShowAtoms.js";
export * from "./songs/SongAtoms.js";
