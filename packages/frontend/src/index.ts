import type { Atom } from "effect/unstable/reactivity";
import { makeMicrophoneAtoms } from "./microphones/MicrophoneAtoms.js";
import { makeMixAtoms } from "./mixes/MixAtoms.js";
import { makeRpcClient, type RpcClientOptions } from "./rpc/RpcClient.js";
import { makeShowAtoms } from "./shows/ShowAtoms.js";
import { makeSongAtoms } from "./songs/SongAtoms.js";

export interface ShowtimeFrontendOptions extends RpcClientOptions {
  readonly focusSignal?: Atom.Atom<unknown>;
}

export const makeShowtimeFrontend = (options: ShowtimeFrontendOptions) => {
  const RpcClient = makeRpcClient(options);
  const atomOptions = { focusSignal: options.focusSignal };

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
export * from "./rpc/Reactivity.js";
export * from "./rpc/RpcClient.js";
export * from "./shows/ShowAtoms.js";
export * from "./songs/SongAtoms.js";
