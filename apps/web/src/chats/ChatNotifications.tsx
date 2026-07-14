import * as React from "react";
import { useAtomValue } from "@effect/atom-react";
import { DateTime } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import type {
  ChatChannel,
  ChatMessage,
  Profile,
  ProfileId,
  ShowId,
  ShowSummary,
} from "@showtime/contracts";
import { chatAtoms, profileAtoms, showsAtom } from "@/client";
import { publishNotificationBlink } from "@/notifications/NotificationCenter";
import { useSelectedProfile } from "@/profiles";
import { enqueueChatNotification } from "./ChatNotificationBatcher";
import { isChatVisibleAtBottom } from "./ChatPresence";
import {
  planChatNotifications,
  type ChatNotificationCursor as Cursor,
} from "./ChatNotificationPolicy";

const cursorKey = (showId: ShowId, profileId: ProfileId, channelId: string) =>
  `showtime.chat-notifications.v1:${showId}:${profileId}:${channelId}`;

const readCursor = (key: string): Cursor | undefined => {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "null") as unknown;
    if (
      typeof value === "object" &&
      value !== null &&
      "sequence" in value &&
      "count" in value &&
      typeof value.sequence === "number" &&
      typeof value.count === "number"
    ) {
      return value as Cursor;
    }
  } catch {
    // A malformed cursor is safely reinitialized from the current snapshot.
  }
  return undefined;
};

const writeCursor = (key: string, cursor: Cursor) => {
  try {
    localStorage.setItem(key, JSON.stringify(cursor));
  } catch {
    // The in-memory snapshot still prevents duplicates during this page lifetime.
  }
};

export function ChatNotificationCoordinator() {
  const profilesResult = useAtomValue(profileAtoms.state);
  const showsResult = useAtomValue(showsAtom);
  const profileState = AsyncResult.isSuccess(profilesResult) ? profilesResult.value : undefined;
  const { selected } = useSelectedProfile(profileState);
  const shows = AsyncResult.isSuccess(showsResult) ? showsResult.value : [];
  if (!selected) return null;
  return shows.map((show) => (
    <ShowChatNotifications
      key={show.id}
      show={show}
      profile={selected}
      profiles={profileState?.profiles ?? []}
    />
  ));
}

function ShowChatNotifications({
  show,
  profile,
  profiles,
}: {
  readonly show: ShowSummary;
  readonly profile: Profile;
  readonly profiles: ReadonlyArray<Profile>;
}) {
  const result = useAtomValue(chatAtoms(show.id, profile.id).state);
  const memory = React.useRef(new Map<string, Cursor>());

  React.useEffect(() => {
    if (!AsyncResult.isSuccess(result)) return;
    for (const channel of result.value.channels) {
      processChannel(show, profile, profiles, channel, memory.current);
    }
  }, [profile, profiles, result, show]);
  return null;
}

function processChannel(
  show: ShowSummary,
  profile: Profile,
  profiles: ReadonlyArray<Profile>,
  channel: ChatChannel,
  memory: Map<string, Cursor>,
) {
  const key = cursorKey(show.id, profile.id, channel.id);
  const previous = memory.get(key) ?? readCursor(key);
  const planned = planChatNotifications({
    previous,
    channel,
    profileId: profile.id,
    visibleAtBottom: isChatVisibleAtBottom(show.id, channel.id, profile.id),
  });
  if (planned.blink) {
    const latestIncomingMessage = findLatestIncomingMessage(
      channel,
      profile.id,
      previous?.sequence,
    );
    const sender = profiles.find(
      (candidate) => candidate.id === latestIncomingMessage?.senderProfileId,
    );
    publishNotificationBlink(sender?.color);
  }
  for (const notification of planned.notifications) {
    if (notification.kind === "summary") {
      const latestMessage = channel.messages[channel.messages.length - 1];
      enqueueChatNotification({
        messageCount: notification.count,
        notification: {
          id: `chat-summary:${show.id}:${profile.id}:${channel.id}:${channel.newestSequence}`,
          kind: "chat",
          title: `${notification.count} new messages in ${channel.name}`,
          timestamp: latestMessage ? DateTime.toEpochMillis(latestMessage.sentAt) : undefined,
          chat: {
            showId: show.id,
            channelId: channel.id,
            channelName: channel.name,
          },
        },
      });
    } else {
      publishMessageNotification(show, profiles, channel, notification.message);
    }
  }
  memory.set(key, planned.cursor);
  writeCursor(key, planned.cursor);
}

function findLatestIncomingMessage(
  channel: ChatChannel,
  profileId: ProfileId,
  afterSequence: number | undefined,
) {
  for (let index = channel.messages.length - 1; index >= 0; index -= 1) {
    const message = channel.messages[index];
    if (
      message &&
      message.senderProfileId !== profileId &&
      (afterSequence === undefined || message.sequence > afterSequence)
    )
      return message;
  }
  return undefined;
}

function publishMessageNotification(
  show: ShowSummary,
  profiles: ReadonlyArray<Profile>,
  channel: ChatChannel,
  message: ChatMessage,
) {
  const sender = profiles.find((profile) => profile.id === message.senderProfileId);
  const senderName = sender?.name ?? "Deleted profile";
  enqueueChatNotification({
    messageCount: 1,
    notification: {
      id: `chat:${message.id}`,
      kind: "chat",
      title: senderName,
      description: message.body,
      timestamp: DateTime.toEpochMillis(message.sentAt),
      chat: {
        showId: show.id,
        channelId: channel.id,
        senderName,
        senderColor: sender?.color,
        channelName: channel.name,
      },
    },
  });
}
