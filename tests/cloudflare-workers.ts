import { resolveStorage } from "../lib/server/d1-compat";

/**
 * Test double for the `cloudflare:workers` module (aliased in vitest.config.ts).
 *
 * This previously exported a bare proxy over process.env, so `env.DB` was always
 * undefined and `requireDb()` threw inside every test. That is why the suite had no
 * coverage of lib/server/store.ts, any API route, or any MCP tool handler despite those
 * being the bulk of the product.
 *
 * It now supplies the same D1-compatible database the Vercel runtime uses, backed by an
 * in-memory SQLite database so tests stay isolated and leave nothing on disk. Everything
 * else still falls through to process.env.
 */
const storage = resolveStorage({
  ...process.env,
  QUEUEPROOF_SQLITE_PATH: process.env.QUEUEPROOF_SQLITE_PATH ?? ":memory:",
});

export const env = new Proxy(process.env as Record<string, unknown>, {
  get(target, property) {
    if (property === "DB") return storage.database ?? undefined;
    // No R2 in tests: document upload is not implemented, and a truthy value here would
    // let a health check report a binding that does not exist.
    if (property === "FILES") return undefined;
    return typeof property === "string" ? target[property] : undefined;
  },
  has(target, property) {
    if (property === "DB") return storage.database !== null;
    if (property === "FILES") return false;
    return property in target;
  },
});

