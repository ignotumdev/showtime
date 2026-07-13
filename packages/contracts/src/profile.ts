import { Schema } from "effect";
import { Color } from "./color.js";
import { idAlphabet, idSuffixLength } from "./ids.js";

export const profileIdPrefix = "profile_";
const profileIdPattern = new RegExp(`^${profileIdPrefix}[${idAlphabet}]{${idSuffixLength}}$`);

export const ProfileId = Schema.String.pipe(
  Schema.check(Schema.isPattern(profileIdPattern, { expected: "a Showtime profile ID" })),
  Schema.brand("ProfileId"),
);
export type ProfileId = typeof ProfileId.Type;

export const ProfileName = Schema.String.pipe(
  Schema.check(
    Schema.makeFilter((value) => value.trim().length > 0 && value.trim().length <= 80, {
      expected: "a profile name between 1 and 80 characters",
    }),
  ),
  Schema.brand("ProfileName"),
);
export type ProfileName = typeof ProfileName.Type;

export const Profile = Schema.Struct({
  id: ProfileId,
  name: ProfileName,
  color: Color,
  createdAt: Schema.String,
  updatedAt: Schema.String,
});
export type Profile = typeof Profile.Type;

export const ProfilesState = Schema.Struct({
  profiles: Schema.Array(Profile),
  defaultProfileId: ProfileId,
});
export type ProfilesState = typeof ProfilesState.Type;

export const decodeProfileName = Schema.decodeUnknownEffect(ProfileName);
