import { Context, DateTime, Effect, Layer } from "effect";
import {
  mainMixId,
  MixId,
  MixNumber,
  RpcError,
  type Color,
  type Mix,
  type ShowId,
} from "@showtime/contracts";
import { Ids } from "../ids/Ids";
import { ShowFile } from "../shows/ShowFile";
import { ShowRepository } from "../shows/ShowRepository";

interface MixServiceShape {
  readonly list: (showId: ShowId) => Effect.Effect<ReadonlyArray<Mix>, RpcError>;
  readonly create: (params: {
    readonly showId: ShowId;
    readonly color: Color;
  }) => Effect.Effect<Mix, RpcError>;
  readonly edit: (params: {
    readonly showId: ShowId;
    readonly id: MixId;
    readonly number: MixNumber;
    readonly color: Color;
    readonly name?: string;
  }) => Effect.Effect<Mix, RpcError>;
  readonly delete: (params: {
    readonly showId: ShowId;
    readonly id: MixId;
  }) => Effect.Effect<void, RpcError>;
}

export class MixService extends Context.Service<MixService, MixServiceShape>()(
  "showtime/MixService",
) {}

const toRpcError = (message: string) => (cause: unknown) => new RpcError({ message, cause });

const make = Effect.fnUntraced(function* () {
  const ids = yield* Ids;
  const repository = yield* ShowRepository;
  const showFile = yield* ShowFile;

  const list: MixServiceShape["list"] = Effect.fnUntraced(function* (showId) {
    return (yield* repository.findById(showId)).document.mixes.filter(
      (mix) => mix.deletedAt === undefined,
    );
  });

  const create: MixServiceShape["create"] = Effect.fnUntraced(function* ({ showId, color }) {
    const found = yield* repository.findById(showId);
    const id = yield* ids.makeMixId;
    const number = MixNumber.make(
      String(
        Math.max(
          0,
          ...found.document.mixes
            .filter((mix) => mix.deletedAt === undefined)
            .map((mix) => Number(mix.number))
            .filter(Number.isSafeInteger),
        ) + 1,
      ),
    );
    const now = yield* DateTime.now;
    const mix: Mix = { id, number, color, createdAt: now, updatedAt: now };
    yield* showFile
      .update(found.path, (document) => ({ ...document, mixes: [...document.mixes, mix] }))
      .pipe(Effect.mapError(toRpcError("Could not add mix.")));
    return mix;
  });

  const edit: MixServiceShape["edit"] = Effect.fnUntraced(function* (params) {
    const found = yield* repository.findById(params.showId);
    const existing = found.document.mixes.find(
      (mix) => mix.id === params.id && mix.deletedAt === undefined,
    );
    if (existing === undefined)
      return yield* Effect.fail(new RpcError({ message: "Mix not found." }));
    const trimmedName = params.name?.trim();
    const now = yield* DateTime.now;
    const existingForUpdate =
      params.name === undefined
        ? existing
        : (({ name: _name, ...withoutName }) => withoutName)(existing);
    const mix: Mix = {
      ...existingForUpdate,
      number: params.number,
      color: params.color,
      updatedAt: now,
      ...(trimmedName ? { name: trimmedName } : {}),
    };
    yield* showFile
      .update(found.path, (document) => ({
        ...document,
        mixes: document.mixes.map((item) => (item.id === params.id ? mix : item)),
      }))
      .pipe(Effect.mapError(toRpcError("Could not edit mix.")));
    return mix;
  });

  const deleteMix: MixServiceShape["delete"] = Effect.fnUntraced(function* (params) {
    if (params.id === mainMixId) {
      return yield* Effect.fail(new RpcError({ message: "The main mix cannot be deleted." }));
    }
    const found = yield* repository.findById(params.showId);
    if (!found.document.mixes.some((mix) => mix.id === params.id && mix.deletedAt === undefined)) {
      return yield* Effect.fail(new RpcError({ message: "Mix not found." }));
    }
    const now = yield* DateTime.now;
    yield* showFile
      .update(found.path, (document) => ({
        ...document,
        mixes: document.mixes.map((mix) =>
          mix.id === params.id ? { ...mix, updatedAt: now, deletedAt: now } : mix,
        ),
      }))
      .pipe(Effect.mapError(toRpcError("Could not delete mix.")));
  });

  return MixService.of({ list, create, edit, delete: deleteMix });
});

export const layer = Layer.effect(MixService, make());
