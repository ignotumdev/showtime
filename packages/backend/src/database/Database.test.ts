import { SqliteClient } from "@effect/sql-sqlite-node";
import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  currentMigrations,
  DatabaseBackup,
  DatabaseReady,
  UnsupportedPrereleaseStateError,
} from "./Database.js";
import { makeDatabaseTestLayer } from "./DatabaseTest.js";

const homes = new Set<string>();
afterEach(async () => {
  await Promise.all(Array.from(homes, (home) => rm(home, { recursive: true, force: true })));
  homes.clear();
});

const makeHome = async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "showtime-database-"));
  homes.add(home);
  return home;
};

const runDatabase = <A>(
  home: string,
  effect: Effect.Effect<
    A,
    unknown,
    DatabaseReady | SqlClient.SqlClient | SqliteClient.SqliteClient | DatabaseBackup
  >,
) => Effect.runPromise(effect.pipe(Effect.provide(makeDatabaseTestLayer(home)), Effect.scoped));

describe("Showtime database", () => {
  it("creates migration 1, bootstrap state, safety pragmas, and a consistent backup", async () => {
    const home = await makeHome();
    const backupPath = path.join(home, "backup.db");
    const result = await runDatabase(
      home,
      Effect.gen(function* () {
        yield* DatabaseReady;
        const sql = yield* SqlClient.SqlClient;
        const ledger = yield* sql<{ migration_id: number; name: string }>`SELECT migration_id, name
          FROM effect_sql_migrations ORDER BY migration_id`;
        const settings = yield* sql<{ settings: number; profiles: number }>`SELECT
          (SELECT COUNT(*) FROM app_settings) AS settings,
          (SELECT COUNT(*) FROM profiles) AS profiles`;
        const foreignKeys = yield* sql<{ foreign_keys: number }>`PRAGMA foreign_keys`;
        const busyTimeout = yield* sql<{ timeout: number }>`PRAGMA busy_timeout`;
        const synchronous = yield* sql<{ synchronous: number }>`PRAGMA synchronous`;
        const backup = yield* (yield* DatabaseBackup).backup(backupPath);
        return { ledger, settings, foreignKeys, busyTimeout, synchronous, backup };
      }),
    );
    expect(result.ledger).toEqual(
      currentMigrations.map(([migration_id, name]) => ({ migration_id, name })),
    );
    expect(result.settings).toEqual([{ settings: 1, profiles: 1 }]);
    expect(result.foreignKeys).toEqual([{ foreign_keys: 1 }]);
    expect(result.busyTimeout).toEqual([{ timeout: 5000 }]);
    expect(result.synchronous).toEqual([{ synchronous: 2 }]);
    expect(result.backup.remainingPages).toBe(0);
    await expect(stat(backupPath)).resolves.toBeDefined();
    const backup = new DatabaseSync(backupPath, { readOnly: true });
    expect(backup.prepare("PRAGMA quick_check").get()).toEqual({ quick_check: "ok" });
    backup.close();
  });

  it("is a no-op on restart and rolls back failed transactions", async () => {
    const home = await makeHome();
    const firstLedger = await runDatabase(
      home,
      Effect.flatMap(
        SqlClient.SqlClient,
        (sql) => sql`SELECT migration_id, name, created_at FROM effect_sql_migrations`,
      ),
    );
    await runDatabase(
      home,
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql
          .withTransaction(
            sql`INSERT INTO profiles
            (id, name, normalized_name, color, created_at, updated_at)
            VALUES ('profile_1111111111111111', 'Rolled back', 'rolled back', 'sky',
              '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`.pipe(
              Effect.andThen(Effect.fail("rollback")),
            ),
          )
          .pipe(Effect.ignore);
        const rows = yield* sql`SELECT id FROM profiles WHERE id = 'profile_1111111111111111'`;
        expect(rows).toEqual([]);
      }),
    );
    const secondLedger = await runDatabase(
      home,
      Effect.flatMap(
        SqlClient.SqlClient,
        (sql) => sql`SELECT migration_id, name, created_at FROM effect_sql_migrations`,
      ),
    );
    expect(secondLedger).toEqual(firstLedger);
  });

  it("serializes concurrent startup and enforces foreign keys", async () => {
    const home = await makeHome();
    const readLedger = Effect.flatMap(
      SqlClient.SqlClient,
      (sql) => sql<{ migration_id: number; name: string }>`SELECT migration_id, name
        FROM effect_sql_migrations ORDER BY migration_id`,
    );
    const ledgers = await Promise.all([
      runDatabase(home, readLedger),
      runDatabase(home, readLedger),
    ]);
    expect(ledgers).toEqual([
      currentMigrations.map(([migration_id, name]) => ({ migration_id, name })),
      currentMigrations.map(([migration_id, name]) => ({ migration_id, name })),
    ]);

    await expect(
      runDatabase(
        home,
        Effect.flatMap(
          SqlClient.SqlClient,
          (sql) => sql`INSERT INTO microphones
            (id, show_id, position, number, color, name, created_at, updated_at)
            VALUES ('mic_1111111111111111', 'show_1111111111111111', 0, 1, 'sky', 'Invalid',
              '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
        ),
      ),
    ).rejects.toBeDefined();
  });

  it.each([
    ["settings.json", "{}"],
    ["profiles.json", "{}"],
    ["connections.json", "{}"],
    ["chats.db", "prerelease"],
  ])("rejects prerelease %s without creating or changing state", async (name, contents) => {
    const home = await makeHome();
    const directory = path.join(home, ".showtime");
    await mkdir(directory);
    const legacyPath = path.join(directory, name);
    await writeFile(legacyPath, contents);
    const before = await readFile(legacyPath);
    await expect(runDatabase(home, Effect.void)).rejects.toBeInstanceOf(
      UnsupportedPrereleaseStateError,
    );
    expect(await readFile(legacyPath)).toEqual(before);
    await expect(stat(path.join(directory, "showtime.db"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("rejects discovered prerelease show documents", async () => {
    const home = await makeHome();
    const shows = path.join(home, ".showtime", "shows");
    await mkdir(shows, { recursive: true });
    const showPath = path.join(shows, "festival.showtime");
    await writeFile(showPath, '{"type":"showtime-show","version":1}');
    const before = await readFile(showPath);
    await expect(runDatabase(home, Effect.void)).rejects.toBeInstanceOf(
      UnsupportedPrereleaseStateError,
    );
    expect(await readFile(showPath)).toEqual(before);
  });

  it("rejects an experimental database and leaves it byte-for-byte unchanged", async () => {
    const home = await makeHome();
    const directory = path.join(home, ".showtime");
    await mkdir(directory);
    const filename = path.join(directory, "showtime.db");
    const db = new DatabaseSync(filename);
    db.exec(
      "CREATE TABLE prerelease_state (value TEXT); INSERT INTO prerelease_state VALUES ('keep')",
    );
    db.close();
    const before = await readFile(filename);
    await expect(runDatabase(home, Effect.void)).rejects.toBeInstanceOf(
      UnsupportedPrereleaseStateError,
    );
    expect(await readFile(filename)).toEqual(before);
  });

  it("rejects unknown future ledger entries without opening the database for writes", async () => {
    const home = await makeHome();
    await runDatabase(home, Effect.void);
    const filename = path.join(home, ".showtime", "showtime.db");
    const db = new DatabaseSync(filename);
    db.prepare("INSERT INTO effect_sql_migrations (migration_id, name) VALUES (?, ?)").run(
      999,
      "future",
    );
    db.close();
    const before = await readFile(filename);
    await expect(runDatabase(home, Effect.void)).rejects.toBeInstanceOf(
      UnsupportedPrereleaseStateError,
    );
    expect(await readFile(filename)).toEqual(before);
  });
});
