import {
  mainMixId,
  type Color,
  type Microphone,
  type MicrophoneId,
  type Mix,
  type MixId,
  type Song,
  type SongId,
} from "@showtime/contracts";

export type LiveMicrophoneView = {
  readonly id: MicrophoneId;
  readonly number: string;
  readonly color: Color;
  readonly name: string;
};

export type LiveMixView = {
  readonly id: MixId;
  readonly number: string;
  readonly color: Color;
  readonly name: string;
  readonly microphones: ReadonlyArray<LiveMicrophoneView>;
};

export type LiveSongView = {
  readonly id: SongId;
  readonly position: number;
  readonly total: number;
  readonly name: string;
  readonly artist?: string;
  readonly notes?: string;
  readonly mixes: ReadonlyArray<LiveMixView>;
};

export function projectLiveSong(
  song: Song,
  position: number,
  total: number,
  mixes: ReadonlyArray<Mix>,
  microphones: ReadonlyArray<Microphone>,
): LiveSongView {
  const activeMicrophones = microphones.filter((microphone) => !microphone.deletedAt);
  const overrides = new Map(
    (song.microphoneNames ?? []).map((item) => [item.microphoneId, item.name.trim()]),
  );
  const mixOverrides = new Map((song.mixNames ?? []).map((item) => [item.mixId, item.name.trim()]));
  const orderedMixes = mixes
    .filter((mix) => !mix.deletedAt)
    .map((mix, sourceIndex) => ({ mix, sourceIndex }))
    .sort(
      (left, right) =>
        Number(right.mix.id === mainMixId) - Number(left.mix.id === mainMixId) ||
        left.sourceIndex - right.sourceIndex,
    );

  const projectedMixes = orderedMixes.flatMap(({ mix }) => {
    const assignment = song.mixAssignments.find((item) => item.mixId === mix.id);
    const assignedIds = new Set(assignment?.microphoneIds ?? []);
    const assigned = activeMicrophones.flatMap((microphone): ReadonlyArray<LiveMicrophoneView> => {
      if (!assignedIds.has(microphone.id)) return [];
      const override = overrides.get(microphone.id);
      const globalName = microphone.name?.trim();
      return [
        {
          id: microphone.id,
          number: microphone.number,
          color: microphone.color,
          name: override || globalName || `Microphone ${microphone.number}`,
        },
      ];
    });
    if (assigned.length === 0) return [];
    return [
      {
        id: mix.id,
        number: mix.number,
        color: mix.color,
        name:
          mixOverrides.get(mix.id) || mix.name?.trim() || (mix.id === mainMixId ? "Main" : "Mix"),
        microphones: assigned,
      },
    ];
  });

  const artist = song.artist.trim();
  const notes = song.notes?.trim();
  return {
    id: song.id,
    position,
    total,
    name: song.name,
    ...(artist ? { artist } : {}),
    ...(notes ? { notes } : {}),
    mixes: projectedMixes,
  };
}
