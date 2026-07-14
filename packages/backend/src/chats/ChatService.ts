import { Context, DateTime, Effect, Layer } from "effect";
import { SqlClient } from "effect/unstable/sql";
import {
  decodeChatChannelName,
  decodeChatMessageBody,
  RpcError,
  type ChatChannel,
  type ChatChannelId,
  type ChatMessage,
  type ChatSequence,
  type ChatSnapshot,
  type ProfileId,
  type ShowId,
} from "@showtime/contracts";
import { Ids } from "../ids/Ids.js";
import { ProfileService } from "../profiles/ProfileService.js";

const replayLimit = 100;

interface ChannelRow {
  readonly id: string;
  readonly show_id: string;
  readonly name: string;
  readonly created_at: string;
  readonly message_count: number;
  readonly incoming_message_count: number;
  readonly newest_sequence: number | null;
  readonly last_read_sequence: number | null;
  readonly notifications_enabled: number | null;
  readonly unread_count: number;
}

interface MessageRow {
  readonly id: string;
  readonly sequence: number;
  readonly show_id: string;
  readonly channel_id: string;
  readonly sender_profile_id: string;
  readonly body: string;
  readonly sent_at: string;
}

export class ChatService extends Context.Service<
  ChatService,
  {
    readonly state: (showId: ShowId, profileId: ProfileId) => Effect.Effect<ChatSnapshot, RpcError>;
    readonly createChannel: (params: {
      readonly showId: ShowId;
      readonly name: string;
    }) => Effect.Effect<ChatChannel, RpcError>;
    readonly send: (params: {
      readonly showId: ShowId;
      readonly channelId: ChatChannelId;
      readonly senderProfileId: ProfileId;
      readonly body: string;
    }) => Effect.Effect<ChatMessage, RpcError>;
    readonly markRead: (params: {
      readonly showId: ShowId;
      readonly channelId: ChatChannelId;
      readonly profileId: ProfileId;
      readonly sequence: ChatSequence;
    }) => Effect.Effect<void, RpcError>;
    readonly setNotifications: (params: {
      readonly showId: ShowId;
      readonly channelId: ChatChannelId;
      readonly profileId: ProfileId;
      readonly enabled: boolean;
    }) => Effect.Effect<void, RpcError>;
    readonly deleteShow: (showId: ShowId) => Effect.Effect<void, RpcError>;
  }
>()("@showtime/backend/chats/ChatService") {}

const rpcError = (message: string, cause?: unknown) =>
  new RpcError({ message, ...(cause === undefined ? {} : { cause }) });

const toMessage = (row: MessageRow): ChatMessage => ({
  id: row.id as ChatMessage["id"],
  sequence: row.sequence as ChatSequence,
  showId: row.show_id as ShowId,
  channelId: row.channel_id as ChatChannelId,
  senderProfileId: row.sender_profile_id as ProfileId,
  body: row.body as ChatMessage["body"],
  sentAt: DateTime.makeUnsafe(row.sent_at),
});

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const ids = yield* Ids;
  const profiles = yield* ProfileService;

  yield* sql`PRAGMA foreign_keys = ON`;
  yield* sql`PRAGMA busy_timeout = 5000`;
  yield* sql`CREATE TABLE IF NOT EXISTS chat_channels (
    id TEXT PRIMARY KEY,
    show_id TEXT NOT NULL,
    name TEXT NOT NULL COLLATE NOCASE,
    created_at TEXT NOT NULL,
    UNIQUE(show_id, name)
  )`;
  yield* sql`CREATE TABLE IF NOT EXISTS chat_messages (
    sequence INTEGER PRIMARY KEY AUTOINCREMENT,
    id TEXT NOT NULL UNIQUE,
    show_id TEXT NOT NULL,
    channel_id TEXT NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
    sender_profile_id TEXT NOT NULL,
    body TEXT NOT NULL,
    sent_at TEXT NOT NULL
  )`;
  yield* sql`CREATE INDEX IF NOT EXISTS chat_messages_channel_sequence
    ON chat_messages(channel_id, sequence)`;
  yield* sql`CREATE TABLE IF NOT EXISTS chat_profile_channel_state (
    show_id TEXT NOT NULL,
    channel_id TEXT NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
    profile_id TEXT NOT NULL,
    last_read_sequence INTEGER NOT NULL DEFAULT 0,
    notifications_enabled INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY(show_id, channel_id, profile_id)
  )`;

  const ensureProfile = (profileId: ProfileId) =>
    profiles.list.pipe(
      Effect.flatMap((state) =>
        state.profiles.some((profile) => profile.id === profileId)
          ? Effect.void
          : Effect.fail(rpcError("The selected profile no longer exists.")),
      ),
    );

  const ensureDefaultChannel = (showId: ShowId) =>
    Effect.gen(function* () {
      const rows = (yield* sql`SELECT id FROM chat_channels WHERE show_id = ${showId} LIMIT 1`) as
        | ReadonlyArray<{ readonly id: string }>
        | undefined;
      if (rows && rows.length > 0) return;
      const id = yield* ids.makeChatChannelId;
      const createdAt = DateTime.formatIso(yield* DateTime.now);
      yield* sql`INSERT INTO chat_channels (id, show_id, name, created_at)
        VALUES (${id}, ${showId}, ${"General"}, ${createdAt})`;
    }).pipe(sql.withTransaction);

  const loadMessages = (showId: ShowId) =>
    Effect.gen(function* () {
      const rows =
        (yield* sql`SELECT id, sequence, show_id, channel_id, sender_profile_id, body, sent_at
        FROM (
          SELECT m.*,
            ROW_NUMBER() OVER (PARTITION BY m.channel_id ORDER BY m.sequence DESC) AS replay_rank
          FROM chat_channels c
          INNER JOIN chat_messages m ON m.channel_id = c.id
          WHERE c.show_id = ${showId}
        )
        WHERE replay_rank <= ${replayLimit}
        ORDER BY sequence`) as unknown as ReadonlyArray<MessageRow>;
      const byChannel = new Map<ChatChannelId, Array<ChatMessage>>();
      for (const row of rows) {
        const channelId = row.channel_id as ChatChannelId;
        const messages = byChannel.get(channelId);
        if (messages) messages.push(toMessage(row));
        else byChannel.set(channelId, [toMessage(row)]);
      }
      return byChannel;
    });

  const state = (showId: ShowId, profileId: ProfileId) =>
    Effect.gen(function* () {
      yield* ensureProfile(profileId);
      yield* ensureDefaultChannel(showId);
      const rows = (yield* sql`SELECT
          c.id,
          c.show_id,
          c.name,
          c.created_at,
          COUNT(m.sequence) AS message_count,
          SUM(CASE WHEN m.sender_profile_id != ${profileId} THEN 1 ELSE 0 END) AS incoming_message_count,
          MAX(m.sequence) AS newest_sequence,
          s.last_read_sequence,
          s.notifications_enabled,
          SUM(CASE WHEN m.sequence > COALESCE(s.last_read_sequence, 0) THEN 1 ELSE 0 END) AS unread_count
        FROM chat_channels c
        LEFT JOIN chat_profile_channel_state s
          ON s.show_id = c.show_id AND s.channel_id = c.id AND s.profile_id = ${profileId}
        LEFT JOIN chat_messages m ON m.channel_id = c.id
        WHERE c.show_id = ${showId}
        GROUP BY c.id
        ORDER BY c.created_at, c.id`) as unknown as ReadonlyArray<ChannelRow>;
      const messagesByChannel = yield* loadMessages(showId);
      const channels = rows.map((row): ChatChannel => {
        const messages = messagesByChannel.get(row.id as ChatChannelId) ?? [];
        const newestSequence = (row.newest_sequence ?? 0) as ChatSequence;
        return {
          id: row.id as ChatChannelId,
          showId,
          name: row.name as ChatChannel["name"],
          createdAt: DateTime.makeUnsafe(row.created_at),
          messages,
          messageCount: Number(row.message_count),
          incomingMessageCount: Number(row.incoming_message_count),
          unreadCount: Number(row.unread_count),
          lastReadSequence: Number(row.last_read_sequence ?? 0) as ChatSequence,
          earliestReplaySequence: (messages[0]?.sequence ?? newestSequence) as ChatSequence,
          newestSequence,
          notificationsEnabled: row.notifications_enabled !== 0,
        };
      });
      return { showId, profileId, channels } satisfies ChatSnapshot;
    }).pipe(
      Effect.mapError((cause) =>
        cause instanceof RpcError ? cause : rpcError("Could not load chat.", cause),
      ),
    );

  const createChannel = ({
    showId,
    name: inputName,
  }: {
    readonly showId: ShowId;
    readonly name: string;
  }) =>
    Effect.gen(function* () {
      const name = yield* decodeChatChannelName(inputName.trim()).pipe(
        Effect.mapError((cause) => rpcError("Channel names must be 1 to 60 characters.", cause)),
      );
      const id = yield* ids.makeChatChannelId;
      const createdAt = yield* DateTime.now;
      yield* sql`INSERT INTO chat_channels (id, show_id, name, created_at)
        VALUES (${id}, ${showId}, ${name}, ${DateTime.formatIso(createdAt)})`;
      return {
        id,
        showId,
        name,
        createdAt,
        messages: [],
        messageCount: 0,
        incomingMessageCount: 0,
        unreadCount: 0,
        lastReadSequence: 0 as ChatSequence,
        earliestReplaySequence: 0 as ChatSequence,
        newestSequence: 0 as ChatSequence,
        notificationsEnabled: true,
      } satisfies ChatChannel;
    }).pipe(
      Effect.mapError((cause) =>
        cause instanceof RpcError
          ? cause
          : rpcError("Could not create channel. Channel names must be unique.", cause),
      ),
    );

  const send = (params: {
    readonly showId: ShowId;
    readonly channelId: ChatChannelId;
    readonly senderProfileId: ProfileId;
    readonly body: string;
  }) =>
    Effect.gen(function* () {
      yield* ensureProfile(params.senderProfileId);
      const body = yield* decodeChatMessageBody(params.body.trim()).pipe(
        Effect.mapError((cause) => rpcError("Messages must be 1 to 4000 characters.", cause)),
      );
      const channel = (yield* sql`SELECT id FROM chat_channels
        WHERE id = ${params.channelId} AND show_id = ${params.showId}`) as unknown as ReadonlyArray<{
        id: string;
      }>;
      if (channel.length === 0) return yield* Effect.fail(rpcError("Channel not found."));
      const id = yield* ids.makeChatMessageId;
      const sentAt = yield* DateTime.now;
      const inserted = (yield* sql`INSERT INTO chat_messages
          (id, show_id, channel_id, sender_profile_id, body, sent_at)
        VALUES (${id}, ${params.showId}, ${params.channelId}, ${params.senderProfileId}, ${body}, ${DateTime.formatIso(sentAt)})
        RETURNING sequence`) as unknown as ReadonlyArray<{ sequence: number }>;
      const sequence = Number(inserted[0]!.sequence) as ChatSequence;
      yield* sql`INSERT INTO chat_profile_channel_state
          (show_id, channel_id, profile_id, last_read_sequence, notifications_enabled)
        VALUES (${params.showId}, ${params.channelId}, ${params.senderProfileId}, ${sequence}, 1)
        ON CONFLICT(show_id, channel_id, profile_id) DO UPDATE SET
          last_read_sequence = MAX(last_read_sequence, excluded.last_read_sequence)`;
      return {
        id,
        sequence,
        showId: params.showId,
        channelId: params.channelId,
        senderProfileId: params.senderProfileId,
        body,
        sentAt,
      } satisfies ChatMessage;
    }).pipe(
      sql.withTransaction,
      Effect.mapError((cause) =>
        cause instanceof RpcError ? cause : rpcError("Could not send message.", cause),
      ),
    );

  const markRead = (params: {
    readonly showId: ShowId;
    readonly channelId: ChatChannelId;
    readonly profileId: ProfileId;
    readonly sequence: ChatSequence;
  }) =>
    Effect.gen(function* () {
      yield* ensureProfile(params.profileId);
      yield* sql`INSERT INTO chat_profile_channel_state
          (show_id, channel_id, profile_id, last_read_sequence, notifications_enabled)
        SELECT ${params.showId}, c.id, ${params.profileId},
          MIN(${params.sequence}, COALESCE(MAX(m.sequence), 0)), 1
        FROM chat_channels c
        LEFT JOIN chat_messages m ON m.channel_id = c.id
        WHERE c.id = ${params.channelId} AND c.show_id = ${params.showId}
        GROUP BY c.id
        ON CONFLICT(show_id, channel_id, profile_id) DO UPDATE SET
          last_read_sequence = MAX(last_read_sequence, excluded.last_read_sequence)`;
    }).pipe(
      Effect.mapError((cause) =>
        cause instanceof RpcError ? cause : rpcError("Could not update chat read state.", cause),
      ),
    );

  const setNotifications = (params: {
    readonly showId: ShowId;
    readonly channelId: ChatChannelId;
    readonly profileId: ProfileId;
    readonly enabled: boolean;
  }) =>
    Effect.gen(function* () {
      yield* ensureProfile(params.profileId);
      yield* sql`INSERT INTO chat_profile_channel_state
          (show_id, channel_id, profile_id, last_read_sequence, notifications_enabled)
        SELECT ${params.showId}, id, ${params.profileId}, 0, ${params.enabled ? 1 : 0}
        FROM chat_channels WHERE id = ${params.channelId} AND show_id = ${params.showId}
        ON CONFLICT(show_id, channel_id, profile_id) DO UPDATE SET
          notifications_enabled = excluded.notifications_enabled`;
    }).pipe(
      Effect.mapError((cause) =>
        cause instanceof RpcError ? cause : rpcError("Could not update notifications.", cause),
      ),
    );

  const deleteShow = (showId: ShowId) =>
    sql`DELETE FROM chat_channels WHERE show_id = ${showId}`.pipe(
      Effect.asVoid,
      Effect.mapError((cause) => rpcError("Could not remove the show's chat.", cause)),
    );

  return ChatService.of({ state, createChannel, send, markRead, setNotifications, deleteShow });
});

export const layer = Layer.effect(ChatService, make);
