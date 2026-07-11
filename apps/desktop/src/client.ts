import { Effect } from "effect";
import { Atom } from "effect/unstable/reactivity";
import { makeShowtimeFrontend } from "@showtime/frontend";

const frontend = makeShowtimeFrontend({
  webSocketUrl: Effect.promise(() => window.showtime.rpcWebSocketUrl()),
  focusSignal: Atom.windowFocusSignal,
});

export const {
  RpcClient,
  createShowAtom,
  deleteShowAtom,
  editShowAtom,
  microphoneAtoms,
  mixAtoms,
  showDialogAtom,
  showMutationAtoms,
  showMutationOptions,
  showsAtom,
  songAtoms,
} = frontend;

export * from "@showtime/frontend";
