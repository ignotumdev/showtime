import { Effect } from "effect";
import { Atom } from "effect/unstable/reactivity";
import { makeShowtimeFrontend } from "@showtime/frontend";
import { resolveRpcWebSocketUrl } from "./platform";

const frontend = makeShowtimeFrontend({
  webSocketUrl: Effect.promise(resolveRpcWebSocketUrl),
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
  profileAtoms,
} = frontend;

export * from "@showtime/frontend";
