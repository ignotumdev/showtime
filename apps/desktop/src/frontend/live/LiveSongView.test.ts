import { describe, expect, it } from "vite-plus/test";
import {
  mainMixId,
  type Microphone,
  type MicrophoneId,
  type Mix,
  type MixId,
  type Song,
  type SongId,
} from "@showtime/contracts";
import { projectLiveSong } from "./LiveSongView";

const main = { id: mainMixId, number: "LR", name: "Main" } as unknown as Mix;
const monitor = { id: "mix_0000000001" as MixId, number: "1", name: "Alex" } as unknown as Mix;
const unused = { id: "mix_0000000002" as MixId, number: "2" } as unknown as Mix;
const leadId = "mic_0000000001" as MicrophoneId;
const guitarId = "mic_0000000002" as MicrophoneId;
const staleId = "mic_0000000003" as MicrophoneId;
const lead = { id: leadId, number: "1", color: "sky", name: "Lead vocal" } as unknown as Microphone;
const guitar = { id: guitarId, number: "4", color: "amber" } as unknown as Microphone;
const deleted = {
  id: staleId,
  number: "8",
  color: "violet",
  deletedAt: {},
} as unknown as Microphone;
const song = {
  id: "song_0000000001" as SongId,
  name: "Fix You",
  artist: "  Coldplay  ",
  notes: "  Quiet opening.\nWatch the cue.  ",
  mixAssignments: [
    { mixId: mainMixId, microphoneIds: [leadId, guitarId, staleId] },
    { mixId: monitor.id, microphoneIds: [guitarId] },
    { mixId: unused.id, microphoneIds: [] },
  ],
  microphoneNames: [{ microphoneId: leadId, name: "Chris" }],
} as unknown as Song;

describe("projectLiveSong", () => {
  it("orders Main first and omits empty mixes and inactive microphones", () => {
    const view = projectLiveSong(song, 3, 12, [monitor, unused, main], [lead, guitar, deleted]);
    expect(view.mixes.map((mix) => mix.id)).toEqual([mainMixId, monitor.id]);
    expect(view.mixes[0]?.microphones.map((microphone) => microphone.id)).toEqual([
      leadId,
      guitarId,
    ]);
  });

  it("resolves overrides, global names, and fallback labels", () => {
    const view = projectLiveSong(song, 3, 12, [main], [lead, guitar]);
    expect(view.mixes[0]?.microphones.map((microphone) => microphone.name)).toEqual([
      "Chris",
      "Microphone 4",
    ]);
  });

  it("trims optional display content while preserving note line breaks", () => {
    const view = projectLiveSong(song, 3, 12, [main], [lead]);
    expect(view.artist).toBe("Coldplay");
    expect(view.notes).toBe("Quiet opening.\nWatch the cue.");
  });
});
