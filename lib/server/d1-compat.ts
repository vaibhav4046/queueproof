/**
 * D1-compatible database facade.
 *
 * QueueProof's entire persistence layer (lib/server/store.ts, lib/server/queue.ts and
 * every app/api route) is written against the Cloudflare D1 statement API:
 *
 *     db.prepare(sql).bind(...args).first<T>() | .all<T>() | .run()
 *     db.batch([stmt, ...])
 *
 * That binding only exists inside a Cloudflare Worker, which is why the Vercel
 * deployment had no durable storage and every route degraded to a stub. This module
 * reimplements exactly that surface over backends Vercel *can* reach, so the existing
 * SQL — including SQLite-only syntax such as `INSERT OR IGNORE` and
 * `CURRENT_TIMESTAMP` defaults — keeps working unchanged.
 *
 * Backends:
 *   - `libsql`  — Turso / libSQL over the HTTP pipeline API. Serverless-safe, used in
 *                 production on Vercel. Plain `fetch`, no extra dependency.
 *   - `sqlite`  — node:sqlite (built into Node >=22.5). Local development, CI and the
 *                 evaluation harness. Zero dependencies.
 *
 * Only the methods QueueProof actually calls are implemented. Anything else throws
 * rather than silently returning a wrong shape.
 */

export type D1Value = string | number | boolean | null | Uint8Array;

export type D1Meta = {
  duration: number;
  changes: number;
  last_row_id: number;
  rows_read: number;
  rows_written: number;
};

export type D1Result<T = Record<string, unknown>> = {
  results: T[];
  success: true;
  meta: D1Meta;
};

/** Normalised result of a single statement, backend-agnostic. */
type RawResult = {
  columns: string[];
  rows: unknown[][];
  changes: number;
  lastInsertRowid: number;
};

interface Executor {
  /** Run statements in order. When `transactional`, all succeed or all roll back. */
  execute(statements: Array<{ sql: string; args: D1Value[] }>, transactional: boolean): Promise<RawResult[]>;
}

const emptyMeta = (durationMs: number, raw?: RawResult): D1Meta => ({
  duration: durationMs,
  changes: raw?.changes ?? 0,
  last_row_id: raw?.lastInsertRowid ?? 0,
  rows_read: raw?.rows.length ?? 0,
  rows_written: raw?.changes ?? 0,
});

function toObjects<T>(raw: RawResult): T[] {
  return raw.rows.map((row) => {
    const record: Record<string, unknown> = {};
    for (let index = 0; index < raw.columns.length; index += 1) {
      record[raw.columns[index]] = row[index];
    }
    return record as T;
  });
}

class CompatStatement {
  constructor(
    private readonly executor: Executor,
    private readonly sql: string,
    private readonly args: D1Value[] = [],
  ) {}

  /** D1 semantics: bind returns a new statement, it does not mutate the receiver. */
  bind(...args: D1Value[]): CompatStatement {
    return new CompatStatement(this.executor, this.sql, args);
  }

  /** Internal shape consumed by `batch`. */
  toPayload(): { sql: string; args: D1Value[] } {
    return { sql: this.sql, args: this.args };
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const startedAt = Date.now();
    const [raw] = await this.executor.execute([this.toPayload()], false);
    return { results: toObjects<T>(raw), success: true, meta: emptyMeta(Date.now() - startedAt, raw) };
  }

  /**
   * `first()` returns the first row, `first(column)` returns one column of it.
   * Both forms are used in this codebase (see app/api/connectors/[id]/proof/route.ts).
   */
  async first<T = Record<string, unknown>>(column?: string): Promise<T | null> {
    const [raw] = await this.executor.execute([this.toPayload()], false);
    if (raw.rows.length === 0) return null;
    const [row] = toObjects<Record<string, unknown>>(raw);
    if (column === undefined) return row as T;
    return (row[column] ?? null) as T;
  }

  async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const startedAt = Date.now();
    const [raw] = await this.executor.execute([this.toPayload()], false);
    return { results: toObjects<T>(raw), success: true, meta: emptyMeta(Date.now() - startedAt, raw) };
  }
}

export class CompatDatabase {
  constructor(private readonly executor: Executor) {}

  prepare(sql: string): CompatStatement {
    return new CompatStatement(this.executor, sql);
  }

  /** D1 batches are atomic — mirror that so partial writes cannot land. */
  async batch<T = Record<string, unknown>>(statements: CompatStatement[]): Promise<D1Result<T>[]> {
    const startedAt = Date.now();
    const raws = await this.executor.execute(
      statements.map((statement) => statement.toPayload()),
      true,
    );
    const duration = Date.now() - startedAt;
    return raws.map((raw) => ({
      results: toObjects<T>(raw),
      success: true as const,
      meta: emptyMeta(duration, raw),
    }));
  }
}

/* ------------------------------------------------------------------ *
 * libSQL / Turso backend (production on Vercel)
 * ------------------------------------------------------------------ */

type LibsqlValue =
  | { type: "null" }
  | { type: "integer"; value: string }
  | { type: "float"; value: number }
  | { type: "text"; value: string }
  | { type: "blob"; base64: string };

function encodeLibsql(value: D1Value): LibsqlValue {
  if (value === null || value === undefined) return { type: "null" };
  if (typeof value === "boolean") return { type: "integer", value: value ? "1" : "0" };
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? { type: "integer", value: String(value) }
      : { type: "float", value };
  }
  if (value instanceof Uint8Array) {
    return { type: "blob", base64: Buffer.from(value).toString("base64") };
  }
  return { type: "text", value: String(value) };
}

function decodeLibsql(value: LibsqlValue): unknown {
  switch (value.type) {
    case "null":
      return null;
    case "integer": {
      // Preserve precision: fall back to the string form beyond Number's safe range.
      const asNumber = Number(value.value);
      return Number.isSafeInteger(asNumber) ? asNumber : value.value;
    }
    case "float":
      return value.value;
    case "text":
      return value.value;
    case "blob":
      return Uint8Array.from(Buffer.from(value.base64, "base64"));
    default:
      return null;
  }
}

class LibsqlExecutor implements Executor {
  private readonly endpoint: string;

  constructor(url: string, private readonly authToken: string) {
    // Accept libsql://, wss:// and https:// forms; the pipeline API is always HTTPS.
    const normalised = url.replace(/^libsql:\/\//, "https://").replace(/^wss:\/\//, "https://");
    this.endpoint = `${normalised.replace(/\/+$/, "")}/v2/pipeline`;
  }

  async execute(
    statements: Array<{ sql: string; args: D1Value[] }>,
    transactional: boolean,
  ): Promise<RawResult[]> {
    const body = transactional && statements.length > 1
      ? [
          { type: "execute", stmt: { sql: "BEGIN" } },
          ...statements.map((s) => ({
            type: "execute" as const,
            stmt: { sql: s.sql, args: s.args.map(encodeLibsql) },
          })),
          { type: "execute", stmt: { sql: "COMMIT" } },
          { type: "close" as const },
        ]
      : [
          ...statements.map((s) => ({
            type: "execute" as const,
            stmt: { sql: s.sql, args: s.args.map(encodeLibsql) },
          })),
          { type: "close" as const },
        ];

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ requests: body }),
    });

    if (!response.ok) {
      // Never surface the auth token; report status only.
      throw new Error(`libSQL request failed with status ${response.status}.`);
    }

    const payload = (await response.json()) as {
      results: Array<
        | { type: "ok"; response?: { type: string; result?: { cols: Array<{ name: string }>; rows: LibsqlValue[][]; affected_row_count?: number; last_insert_rowid?: string | null } } }
        | { type: "error"; error: { message: string } }
      >;
    };

    const failure = payload.results.find((entry) => entry.type === "error");
    if (failure && failure.type === "error") {
      if (transactional && statements.length > 1) {
        // Best-effort rollback so the connection is not left mid-transaction.
        await fetch(this.endpoint, {
          method: "POST",
          headers: { Authorization: `Bearer ${this.authToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ requests: [{ type: "execute", stmt: { sql: "ROLLBACK" } }, { type: "close" }] }),
        }).catch(() => undefined);
      }
      throw new Error(`libSQL statement failed: ${failure.error.message}`);
    }

    // Drop the synthetic BEGIN/COMMIT frames and the trailing close frame so the
    // returned array lines up 1:1 with the caller's statements.
    const executeFrames = payload.results.filter(
      (entry): entry is Extract<typeof entry, { type: "ok" }> =>
        entry.type === "ok" && entry.response?.type === "execute",
    );
    const offset = transactional && statements.length > 1 ? 1 : 0;
    const relevant = executeFrames.slice(offset, offset + statements.length);

    return relevant.map((frame) => {
      const result = frame.response?.result;
      return {
        columns: result?.cols.map((col) => col.name) ?? [],
        rows: (result?.rows ?? []).map((row) => row.map(decodeLibsql)),
        changes: result?.affected_row_count ?? 0,
        lastInsertRowid: Number(result?.last_insert_rowid ?? 0) || 0,
      };
    });
  }
}

/* ------------------------------------------------------------------ *
 * node:sqlite backend (local development, CI, evaluation harness)
 * ------------------------------------------------------------------ */

type SqliteStatement = {
  all: (...args: unknown[]) => Array<Record<string, unknown>>;
  run: (...args: unknown[]) => { changes: number | bigint; lastInsertRowid: number | bigint };
};
type SqliteHandle = { prepare: (sql: string) => SqliteStatement; exec: (sql: string) => void };

class SqliteExecutor implements Executor {
  constructor(private readonly db: SqliteHandle) {}

  private runOne(sql: string, args: D1Value[]): RawResult {
    const statement = this.db.prepare(sql);
    // node:sqlite rejects booleans and undefined; normalise to SQLite-native values.
    const bound = args.map((arg) => {
      if (typeof arg === "boolean") return arg ? 1 : 0;
      if (arg === undefined) return null;
      return arg;
    });

    // A read returns rows; a write throws when queried via all(), so branch on the verb.
    const isRead = /^\s*(SELECT|WITH|PRAGMA|EXPLAIN)/i.test(sql);
    if (isRead) {
      const rows = statement.all(...bound);
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      return {
        columns,
        rows: rows.map((row) => columns.map((column) => row[column])),
        changes: 0,
        lastInsertRowid: 0,
      };
    }

    const info = statement.run(...bound);
    return {
      columns: [],
      rows: [],
      changes: Number(info.changes ?? 0),
      lastInsertRowid: Number(info.lastInsertRowid ?? 0),
    };
  }

  async execute(
    statements: Array<{ sql: string; args: D1Value[] }>,
    transactional: boolean,
  ): Promise<RawResult[]> {
    if (!transactional || statements.length <= 1) {
      return statements.map((statement) => this.runOne(statement.sql, statement.args));
    }
    this.db.exec("BEGIN");
    try {
      const results = statements.map((statement) => this.runOne(statement.sql, statement.args));
      this.db.exec("COMMIT");
      return results;
    } catch (error) {
      try {
        this.db.exec("ROLLBACK");
      } catch {
        /* the transaction was already aborted */
      }
      throw error;
    }
  }
}

/* ------------------------------------------------------------------ *
 * Factory
 * ------------------------------------------------------------------ */

export type StorageBackend = "libsql" | "sqlite" | "ephemeral" | "d1" | "none";

export type StorageResolution = {
  backend: StorageBackend;
  database: CompatDatabase | null;
  /** Human-readable reason, safe to surface in /api/health. Never contains secrets. */
  detail: string;
};

let cached: StorageResolution | null = null;

/**
 * Resolve durable storage from environment. Order matters: hosted libSQL wins so a
 * production deployment never silently falls back to an ephemeral local file.
 */
export function resolveStorage(env: Record<string, unknown>): StorageResolution {
  if (cached) return cached;

  const libsqlUrl = typeof env.TURSO_DATABASE_URL === "string" ? env.TURSO_DATABASE_URL : "";
  const libsqlToken = typeof env.TURSO_AUTH_TOKEN === "string" ? env.TURSO_AUTH_TOKEN : "";
  if (libsqlUrl && libsqlToken) {
    cached = {
      backend: "libsql",
      database: new CompatDatabase(new LibsqlExecutor(libsqlUrl, libsqlToken)),
      detail: "libSQL (hosted) durable storage active.",
    };
    return cached;
  }

  const configuredPath = typeof env.QUEUEPROOF_SQLITE_PATH === "string" ? env.QUEUEPROOF_SQLITE_PATH : "";

  // Explicit opt-in to instance-local storage. A serverless instance has a writable
  // /tmp that survives for the life of that warm instance and no longer, so this makes
  // the product genuinely usable end to end without any hosted database account — while
  // being named `ephemeral` everywhere so nobody mistakes it for durability. It is
  // deliberately never automatic: silently degrading persistence would be far worse than
  // refusing to start.
  const allowEphemeral = env.QUEUEPROOF_ALLOW_EPHEMERAL_STORAGE === "true";
  const sqlitePath = configuredPath || (allowEphemeral ? "/tmp/queueproof-ephemeral.db" : "");
  const backendLabel: StorageBackend = configuredPath ? "sqlite" : "ephemeral";

  if (sqlitePath) {
    try {
      // `process.getBuiltinModule` (Node >=22.3) loads a builtin at runtime without an
      // import statement, so the bundler cannot rewrite or tree-shake it. An earlier
      // attempt using createRequire was erased to `void 0` by webpack, which silently
      // disabled storage — hence the explicit availability check below.
      const getBuiltinModule = (
        process as unknown as { getBuiltinModule?: (id: string) => unknown }
      ).getBuiltinModule;
      if (typeof getBuiltinModule !== "function") {
        throw new Error("process.getBuiltinModule is unavailable (requires Node >=22.3).");
      }
      const sqliteModule = getBuiltinModule("node:sqlite") as
        | { DatabaseSync?: new (path: string) => SqliteHandle }
        | undefined;
      const DatabaseSync = sqliteModule?.DatabaseSync;
      if (typeof DatabaseSync !== "function") {
        throw new Error("node:sqlite did not expose DatabaseSync.");
      }
      cached = {
        backend: backendLabel,
        database: new CompatDatabase(new SqliteExecutor(new DatabaseSync(sqlitePath))),
        detail:
          backendLabel === "sqlite"
            ? "node:sqlite durable storage active (local development)."
            : "Ephemeral instance storage active. Data lives only for the life of this " +
              "serverless instance and is lost on cold start. Set TURSO_DATABASE_URL and " +
              "TURSO_AUTH_TOKEN for durable storage.",
      };
      return cached;
    } catch (error) {
      cached = {
        backend: "none",
        database: null,
        detail: `node:sqlite unavailable: ${error instanceof Error ? error.message : "unknown error"}`,
      };
      return cached;
    }
  }

  cached = {
    backend: "none",
    database: null,
    detail:
      "No storage configured. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN for durable " +
      "hosted storage, QUEUEPROOF_SQLITE_PATH for local development, or " +
      "QUEUEPROOF_ALLOW_EPHEMERAL_STORAGE=true to run on instance-local storage that does " +
      "not survive a cold start.",
  };
  return cached;
}

/** Test-only: clear the memoised resolution so a new environment can be applied. */
export function resetStorageCache(): void {
  cached = null;
}
