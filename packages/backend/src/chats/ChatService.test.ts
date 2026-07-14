import { NodeFileSystem, NodePath } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ChatMessageBody } from "@showtime/contracts";
import * as HomeDirectory from "../platform/HomeDirectory.js";
import * as Ids from "../ids/Ids.js";
import * as ProfileService from "../profiles/ProfileService.js";
import * as ChatDatabase from "./ChatDatabase.js";
import { ChatService, layer } from "./ChatService.js";

const homes: Array<string> = [];

const makeLayer = (home: string) => {
  const profiles = ProfileService.layer.pipe(Layer.provideMerge(Ids.layer));
  return layer.pipe(
    Layer.provideMerge(ChatDatabase.layer),
    Layer.provideMerge(Layer.mergeAll(Ids.layer, profiles)),
    Layer.provide(
      Layer.mergeAll(NodeFileSystem.layer, NodePath.layer, HomeDirectory.makeLayer(home)),
    ),
  );
};

const withService = <A>(
  home: string,
  effect: Effect.Effect<A, unknown, ChatService | Ids.Ids | ProfileService.ProfileService>,
) => Effect.runPromise(effect.pipe(Effect.provide(makeLayer(home))));

afterEach(async () => {
  await Promise.all(homes.splice(0).map((home) => rm(home, { recursive: true, force: true })));
});

describe("ChatService", () => {
  it("persists channels, ordered messages, per-profile read state, and notification settings", async () => {
    const home = await mkdtemp(join(tmpdir(), "showtime-chat-"));
    homes.push(home);

    const initial = await withService(
      home,
      Effect.gen(function* () {
        const ids = yield* Ids.Ids;
        const profiles = yield* ProfileService.ProfileService;
        const chats = yield* ChatService;
        const showId = yield* ids.makeShowId;
        const senderProfileId = (yield* profiles.list).defaultProfileId;
        const profileId = (yield* profiles.create({ name: "Receiver", color: "violet" })).id;
        const state = yield* chats.state(showId, profileId);
        const general = state.channels[0]!;
        yield* Effect.forEach(
          Array.from({ length: 30 }, (_, index) => index),
          (index) =>
            chats.send({
              showId,
              channelId: general.id,
              senderProfileId,
              body: `Message ${index}` as ChatMessageBody,
            }),
          { concurrency: "unbounded" },
        );
        const unread = yield* chats.state(showId, profileId);
        const latest = unread.channels[0]!;
        yield* chats.markRead({
          showId,
          channelId: general.id,
          profileId,
          sequence: latest.newestSequence,
        });
        yield* chats.setNotifications({
          showId,
          channelId: general.id,
          profileId,
          enabled: false,
        });
        yield* chats.createChannel({ showId, name: "Production" });
        return { showId, profileId, unread };
      }),
    );

    expect(initial.unread.channels[0]).toMatchObject({
      messageCount: 30,
      incomingMessageCount: 30,
      unreadCount: 30,
    });
    expect(initial.unread.channels[0]!.messages.map((message) => message.body)).toEqual(
      Array.from({ length: 30 }, (_, index) => `Message ${index}`),
    );

    const reloaded = await withService(
      home,
      Effect.gen(function* () {
        const chats = yield* ChatService;
        return yield* chats.state(initial.showId, initial.profileId);
      }),
    );
    expect(reloaded.channels.map((channel) => channel.name)).toEqual(["General", "Production"]);
    expect(reloaded.channels[0]).toMatchObject({ unreadCount: 0, notificationsEnabled: false });
  });

  it("retains deleted sender ids and bounds replay while reporting the exact total count", async () => {
    const home = await mkdtemp(join(tmpdir(), "showtime-chat-"));
    homes.push(home);

    const result = await withService(
      home,
      Effect.gen(function* () {
        const ids = yield* Ids.Ids;
        const profiles = yield* ProfileService.ProfileService;
        const chats = yield* ChatService;
        const showId = yield* ids.makeShowId;
        const deletedProfileId = (yield* profiles.list).defaultProfileId;
        const replacement = yield* profiles.create({ name: "Replacement", color: "green" });
        const channel = (yield* chats.state(showId, deletedProfileId)).channels[0]!;
        yield* Effect.forEach(
          Array.from({ length: 120 }, (_, index) => index),
          (index) =>
            chats.send({
              showId,
              channelId: channel.id,
              senderProfileId: deletedProfileId,
              body: `Replay ${index}` as ChatMessageBody,
            }),
          { concurrency: 1 },
        );
        yield* profiles.setDefault(replacement.id);
        yield* profiles.delete(deletedProfileId);
        const snapshot = yield* chats.state(showId, replacement.id);
        yield* chats.deleteShow(showId);
        const cleared = yield* chats.state(showId, replacement.id);
        return { snapshot, deletedProfileId, cleared };
      }),
    );

    const channel = result.snapshot.channels[0]!;
    expect(channel.messageCount).toBe(120);
    expect(channel.messages).toHaveLength(100);
    expect(channel.messages[0]!.body).toBe("Replay 20");
    expect(
      channel.messages.every((message) => message.senderProfileId === result.deletedProfileId),
    ).toBe(true);
    expect(result.deletedProfileId).toMatch(/^profile_/);
    expect(result.cleared.channels).toMatchObject([
      { name: "General", messageCount: 0, messages: [] },
    ]);
  });
});
