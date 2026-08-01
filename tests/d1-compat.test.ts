import { beforeEach, describe, expect, it } from "vitest";
import { resetStorageCache, resolveStorage } from "../lib/server/d1-compat";

/**
 * Tests for the D1-compatible storage facade.
 *
 * This layer is what every API route and the whole MCP surface now sit on, so its
 * semantics have to match the Cloudflare D1 contract the callers were written against —
 * in particular that bind() returns a new statement rather than mutating, that first()
 * yields null (not undefined, not a throw) on no rows, and that batch() is atomic.
 */

function sqliteStorage() {
  resetStorageCache();
  // ":memory:" gives each test a private database with no filesystem side effects.
  const resolved = resolveStorage({ QUEUEPROOF_SQLITE_PATH: ":memory:" });
  if (!resolved.database) throw new Error(`storage unavailable: ${resolved.detail}`);
  return resolved;
}

describe("resolveStorage", () => {
  beforeEach(() => resetStorageCache());

  it("selects the sqlite backend from QUEUEPROOF_SQLITE_PATH", () => {
    const resolved = resolveStorage({ QUEUEPROOF_SQLITE_PATH: ":memory:" });
    expect(resolved.backend).toBe("sqlite");
    expect(resolved.database).not.toBeNull();
  });

  it("prefers hosted libSQL over a local file so production cannot silently go ephemeral", () => {
    const resolved = resolveStorage({
      TURSO_DATABASE_URL: "libsql://example.turso.io",
      TURSO_AUTH_TOKEN: "token-value",
      QUEUEPROOF_SQLITE_PATH: ":memory:",
    });
    expect(resolved.backend).toBe("libsql");
  });

  it("reports no storage, with remediation, when nothing is configured", () => {
    const resolved = resolveStorage({});
    expect(resolved.backend).toBe("none");
    expect(resolved.database).toBeNull();
    expect(resolved.detail).toMatch(/TURSO_DATABASE_URL|QUEUEPROOF_SQLITE_PATH/);
  });

  it("never places a credential in the diagnostic detail string", () => {
    const resolved = resolveStorage({
      TURSO_DATABASE_URL: "libsql://example.turso.io",
      TURSO_AUTH_TOKEN: "super-secret-token-value",
    });
    expect(resolved.detail).not.toContain("super-secret-token-value");
  });
});

describe("CompatDatabase (sqlite backend)", () => {
  it("round-trips a write and a read", async () => {
    const db = sqliteStorage().database!;
    await db.prepare("CREATE TABLE t (id TEXT PRIMARY KEY, n INTEGER, f REAL, s TEXT)").run();
    await db.prepare("INSERT INTO t (id, n, f, s) VALUES (?, ?, ?, ?)").bind("a", 42, 1.5, "hi").run();

    const row = await db.prepare("SELECT * FROM t WHERE id = ?").bind("a").first<{
      id: string;
      n: number;
      f: number;
      s: string;
    }>();
    expect(row).toEqual({ id: "a", n: 42, f: 1.5, s: "hi" });
  });

  it("returns null rather than throwing when no row matches", async () => {
    const db = sqliteStorage().database!;
    await db.prepare("CREATE TABLE t (id TEXT PRIMARY KEY)").run();
    expect(await db.prepare("SELECT * FROM t WHERE id = ?").bind("missing").first()).toBeNull();
  });

  it("supports first(column) as well as first()", async () => {
    const db = sqliteStorage().database!;
    await db.prepare("CREATE TABLE t (id TEXT PRIMARY KEY, name TEXT)").run();
    await db.prepare("INSERT INTO t VALUES (?, ?)").bind("a", "Helios").run();
    expect(await db.prepare("SELECT * FROM t WHERE id = ?").bind("a").first<string>("name")).toBe(
      "Helios",
    );
  });

  it("returns every row from all(), in query order", async () => {
    const db = sqliteStorage().database!;
    await db.prepare("CREATE TABLE t (id TEXT PRIMARY KEY)").run();
    await db.prepare("INSERT INTO t VALUES ('b')").run();
    await db.prepare("INSERT INTO t VALUES ('a')").run();

    const result = await db.prepare("SELECT id FROM t ORDER BY id ASC").all<{ id: string }>();
    expect(result.success).toBe(true);
    expect(result.results.map((row) => row.id)).toEqual(["a", "b"]);
  });

  it("returns an empty result set rather than null when nothing matches", async () => {
    const db = sqliteStorage().database!;
    await db.prepare("CREATE TABLE t (id TEXT PRIMARY KEY)").run();
    const result = await db.prepare("SELECT id FROM t").all();
    expect(result.results).toEqual([]);
  });

  it("treats bind() as returning a new statement, never mutating the prepared one", async () => {
    const db = sqliteStorage().database!;
    await db.prepare("CREATE TABLE t (id TEXT PRIMARY KEY)").run();
    await db.prepare("INSERT INTO t VALUES ('a')").run();
    await db.prepare("INSERT INTO t VALUES ('b')").run();

    // Reusing one prepared statement for two different bindings is a D1 idiom; if bind
    // mutated in place, the second call would observe the first call's arguments.
    const statement = db.prepare("SELECT id FROM t WHERE id = ?");
    const first = await statement.bind("a").first<{ id: string }>();
    const second = await statement.bind("b").first<{ id: string }>();
    expect(first?.id).toBe("a");
    expect(second?.id).toBe("b");
  });

  it("round-trips null and boolean bindings the way SQLite stores them", async () => {
    const db = sqliteStorage().database!;
    await db.prepare("CREATE TABLE t (id TEXT PRIMARY KEY, maybe TEXT, flag INTEGER)").run();
    await db.prepare("INSERT INTO t VALUES (?, ?, ?)").bind("a", null, true).run();

    const row = await db.prepare("SELECT * FROM t").first<{ maybe: null; flag: number }>();
    expect(row?.maybe).toBeNull();
    // node:sqlite rejects raw booleans, so the adapter normalises them to 0/1.
    expect(row?.flag).toBe(1);
  });

  it("reports the number of rows a write changed", async () => {
    const db = sqliteStorage().database!;
    await db.prepare("CREATE TABLE t (id TEXT PRIMARY KEY)").run();
    await db.prepare("INSERT INTO t VALUES ('a')").run();
    await db.prepare("INSERT INTO t VALUES ('b')").run();
    const deleted = await db.prepare("DELETE FROM t").run();
    expect(deleted.meta.changes).toBe(2);
  });

  it("applies every statement in a batch", async () => {
    const db = sqliteStorage().database!;
    await db.prepare("CREATE TABLE t (id TEXT PRIMARY KEY)").run();
    await db.batch([
      db.prepare("INSERT INTO t VALUES (?)").bind("a"),
      db.prepare("INSERT INTO t VALUES (?)").bind("b"),
    ]);
    const result = await db.prepare("SELECT id FROM t ORDER BY id").all<{ id: string }>();
    expect(result.results.map((row) => row.id)).toEqual(["a", "b"]);
  });

  it("rolls the whole batch back when one statement fails", async () => {
    const db = sqliteStorage().database!;
    await db.prepare("CREATE TABLE t (id TEXT PRIMARY KEY)").run();
    await db.prepare("INSERT INTO t VALUES ('existing')").run();

    // The second insert violates the primary key. D1 batches are atomic, so the first
    // insert must not survive - a partially applied batch would leave, for example, a
    // workspace row with no owning membership row.
    await expect(
      db.batch([
        db.prepare("INSERT INTO t VALUES (?)").bind("fresh"),
        db.prepare("INSERT INTO t VALUES (?)").bind("existing"),
      ]),
    ).rejects.toThrow();

    const survivor = await db.prepare("SELECT id FROM t WHERE id = ?").bind("fresh").first();
    expect(survivor).toBeNull();
  });

  it("keeps SQLite-only syntax working, which is why the D1 shape was preserved", async () => {
    const db = sqliteStorage().database!;
    await db.prepare("CREATE TABLE t (id TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
    await db.prepare("INSERT INTO t (id) VALUES ('a')").run();
    // INSERT OR IGNORE is used verbatim in lib/server/store.ts and has no Postgres
    // equivalent; a dialect change would have silently broken workspace creation.
    await db.prepare("INSERT OR IGNORE INTO t (id) VALUES ('a')").run();

    const rows = await db.prepare("SELECT id, created_at FROM t").all<{ created_at: string }>();
    expect(rows.results).toHaveLength(1);
    expect(rows.results[0].created_at).toBeTruthy();
  });
});
