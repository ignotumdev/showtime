import { Context, Effect, Layer } from "effect";
import {
  RpcError,
  type Microphone,
  type MicrophoneId,
  type MicrophoneNumber,
  type Color,
  type ShowId,
} from "@showtime/contracts";
import { Ids } from "../ids/Ids";
import { ShowFile } from "../shows/ShowFile";
import { ShowRepository } from "../shows/ShowRepository";

interface MicrophoneServiceShape {
  readonly list: (showId: ShowId) => Effect.Effect<ReadonlyArray<Microphone>, RpcError>;
  readonly create: (params: {
    readonly showId: ShowId;
    readonly color: Color;
  }) => Effect.Effect<Microphone, RpcError>;
  readonly edit: (params: {
    readonly showId: ShowId;
    readonly id: MicrophoneId;
    readonly number: MicrophoneNumber;
    readonly color: Color;
    readonly name?: string;
  }) => Effect.Effect<Microphone, RpcError>;
  readonly delete: (params: {
    readonly showId: ShowId;
    readonly id: MicrophoneId;
  }) => Effect.Effect<void, RpcError>;
}

export class MicrophoneService extends Context.Service<MicrophoneService, MicrophoneServiceShape>()(
  "showtime/MicrophoneService",
) {}

const toRpcError = (message: string) => (cause: unknown) => new RpcError({ message, cause });

const make = Effect.fnUntraced(function* () {
  const ids = yield* Ids;
  const repository = yield* ShowRepository;
  const showFile = yield* ShowFile;

  const list: MicrophoneServiceShape["list"] = Effect.fnUntraced(function* (showId) {
    return (yield* repository.findById(showId)).document.microphones;
  });

  const create: MicrophoneServiceShape["create"] = Effect.fnUntraced(function* ({ showId, color }) {
    const found = yield* repository.findById(showId);
    const id = yield* ids.makeMicrophoneId;
    const number = Math.max(0, ...found.document.microphones.map((mic) => mic.number)) + 1;
    const microphone: Microphone = { id, number, color };
    yield* showFile
      .update(found.path, (document) => ({
        ...document,
        microphones: [...document.microphones, microphone],
      }))
      .pipe(Effect.mapError(toRpcError("Could not add microphone.")));
    return microphone;
  });

  const edit: MicrophoneServiceShape["edit"] = Effect.fnUntraced(function* (params) {
    const found = yield* repository.findById(params.showId);
    if (!found.document.microphones.some((mic) => mic.id === params.id)) {
      return yield* Effect.fail(new RpcError({ message: "Microphone not found." }));
    }
    const trimmedName = params.name?.trim();
    const microphone: Microphone = {
      id: params.id,
      number: params.number,
      color: params.color,
      ...(trimmedName ? { name: trimmedName } : {}),
    };
    yield* showFile
      .update(found.path, (document) => ({
        ...document,
        microphones: document.microphones.map((mic) => (mic.id === params.id ? microphone : mic)),
      }))
      .pipe(Effect.mapError(toRpcError("Could not edit microphone.")));
    return microphone;
  });

  const deleteMicrophone: MicrophoneServiceShape["delete"] = Effect.fnUntraced(function* (params) {
    const found = yield* repository.findById(params.showId);
    if (!found.document.microphones.some((mic) => mic.id === params.id)) {
      return yield* Effect.fail(new RpcError({ message: "Microphone not found." }));
    }
    yield* showFile
      .update(found.path, (document) => ({
        ...document,
        microphones: document.microphones.filter((mic) => mic.id !== params.id),
      }))
      .pipe(Effect.mapError(toRpcError("Could not delete microphone.")));
  });

  return MicrophoneService.of({ list, create, edit, delete: deleteMicrophone });
});

export const layer = Layer.effect(MicrophoneService, make());
