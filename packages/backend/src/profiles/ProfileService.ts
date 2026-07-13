import { Clock, Context, Effect, Layer, Path, Ref, Schema, Semaphore } from "effect";
import { FileSystem } from "effect/FileSystem";
import {
  decodeProfileName,
  Profile as ProfileSchema,
  ProfileId,
  ProfileName,
  RpcError,
  type Color,
  type Profile,
  type ProfilesState,
} from "@showtime/contracts";
import { Ids } from "../ids/Ids.js";
import * as HomeDirectory from "../platform/HomeDirectory.js";
import { isNotFound, readJson, writeJsonAtomic } from "../persistence/JsonFile.js";

const ProfilesFile = Schema.Struct({
  version: Schema.Literal(1),
  profiles: Schema.Array(ProfileSchema),
  defaultProfileId: ProfileId,
});

type ProfilesFile = typeof ProfilesFile.Type;

export class ProfileService extends Context.Service<
  ProfileService,
  {
    readonly list: Effect.Effect<ProfilesState, RpcError>;
    readonly create: (params: {
      readonly name: string;
      readonly color: Color;
    }) => Effect.Effect<Profile, RpcError>;
    readonly edit: (params: {
      readonly id: ProfileId;
      readonly name: string;
      readonly color: Color;
    }) => Effect.Effect<Profile, RpcError>;
    readonly delete: (id: ProfileId) => Effect.Effect<void, RpcError>;
    readonly setDefault: (id: ProfileId) => Effect.Effect<void, RpcError>;
  }
>()("@showtime/backend/profiles/ProfileService") {}

const rpcError = (message: string, cause?: unknown) =>
  new RpcError({ message, ...(cause === undefined ? {} : { cause }) });

const make = Effect.gen(function* () {
  const fs = yield* FileSystem;
  const path = yield* Path.Path;
  const home = yield* HomeDirectory.HomeDirectory;
  const ids = yield* Ids;
  const directory = path.join(yield* home.homeDirectory, ".showtime");
  const filePath = path.join(directory, "profiles.json");
  const loaded = yield* readJson(fs, filePath, ProfilesFile).pipe(
    Effect.map((value) => ({ value, isNew: false as const })),
    Effect.catchIf(isNotFound, () =>
      Effect.gen(function* () {
        const now = new Date(yield* Clock.currentTimeMillis).toISOString();
        const defaultProfile = {
          id: yield* ids.makeProfileId,
          name: ProfileName.make("Default"),
          color: "sky" as const,
          createdAt: now,
          updatedAt: now,
        };
        return {
          value: {
            version: 1 as const,
            profiles: [defaultProfile],
            defaultProfileId: defaultProfile.id,
          },
          isNew: true as const,
        };
      }),
    ),
    Effect.mapError((cause) => rpcError("Could not load profiles.", cause)),
  );
  const initial = loaded.value;
  const idsInFile = new Set(initial.profiles.map((profile) => profile.id));
  if (
    initial.profiles.length === 0 ||
    idsInFile.size !== initial.profiles.length ||
    !idsInFile.has(initial.defaultProfileId)
  ) {
    return yield* Effect.fail(rpcError("The profiles file is inconsistent."));
  }
  if (loaded.isNew) {
    yield* writeJsonAtomic(fs, directory, filePath, initial).pipe(
      Effect.mapError((cause) => rpcError("Could not create the default profile.", cause)),
    );
  }
  const state = yield* Ref.make<ProfilesFile>(initial);
  const lock = yield* Semaphore.make(1);
  const persist = (next: ProfilesFile) =>
    writeJsonAtomic(fs, directory, filePath, next).pipe(
      Effect.mapError((cause) => rpcError("Could not save profiles.", cause)),
      Effect.andThen(Ref.set(state, next)),
    );

  const list = Ref.get(state).pipe(
    Effect.map(({ profiles, defaultProfileId }) => ({ profiles, defaultProfileId })),
  );

  const create = (params: { readonly name: string; readonly color: Color }) =>
    lock.withPermits(1)(
      Effect.gen(function* () {
        const name = yield* decodeProfileName(params.name.trim()).pipe(
          Effect.mapError((cause) =>
            rpcError("Profile name cannot be empty or longer than 80 characters.", cause),
          ),
        );
        const timestamp = new Date(yield* Clock.currentTimeMillis).toISOString();
        const profile: Profile = {
          id: yield* ids.makeProfileId,
          name,
          color: params.color,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        const current = yield* Ref.get(state);
        yield* persist({ ...current, profiles: [...current.profiles, profile] });
        return profile;
      }),
    );

  const edit = (params: { readonly id: ProfileId; readonly name: string; readonly color: Color }) =>
    lock.withPermits(1)(
      Effect.gen(function* () {
        const name = yield* decodeProfileName(params.name.trim()).pipe(
          Effect.mapError((cause) =>
            rpcError("Profile name cannot be empty or longer than 80 characters.", cause),
          ),
        );
        const current = yield* Ref.get(state);
        const existing = current.profiles.find((profile) => profile.id === params.id);
        if (!existing) return yield* Effect.fail(rpcError("Profile not found."));
        const updated: Profile = {
          ...existing,
          name,
          color: params.color,
          updatedAt: new Date(yield* Clock.currentTimeMillis).toISOString(),
        };
        yield* persist({
          ...current,
          profiles: current.profiles.map((profile) =>
            profile.id === params.id ? updated : profile,
          ),
        });
        return updated;
      }),
    );

  const deleteProfile = (id: ProfileId) =>
    lock.withPermits(1)(
      Effect.gen(function* () {
        const current = yield* Ref.get(state);
        if (!current.profiles.some((profile) => profile.id === id))
          return yield* Effect.fail(rpcError("Profile not found."));
        if (current.defaultProfileId === id)
          return yield* Effect.fail(
            rpcError("Choose another default profile before deleting this one."),
          );
        yield* persist({
          ...current,
          profiles: current.profiles.filter((profile) => profile.id !== id),
        });
      }),
    );

  const setDefault = (id: ProfileId) =>
    lock.withPermits(1)(
      Effect.gen(function* () {
        const current = yield* Ref.get(state);
        if (!current.profiles.some((profile) => profile.id === id))
          return yield* Effect.fail(rpcError("Profile not found."));
        yield* persist({ ...current, defaultProfileId: id });
      }),
    );

  return ProfileService.of({ list, create, edit, delete: deleteProfile, setDefault });
});

export const layer = Layer.effect(ProfileService, make);
