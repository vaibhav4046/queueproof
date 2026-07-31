/**
 * Vercel/Node runtime bindings.
 *
 * next.config.ts aliases lib/server/runtime-provider.ts to this file for the Vercel
 * build, because `cloudflare:workers` cannot be imported outside a Worker.
 *
 * Previously this exported `process.env` alone, so `runtimeEnv().DB` was always
 * undefined and every API route degraded to a preview stub — which is why
 * queueproof.vercel.app had no product behind it. It now supplies a D1-compatible
 * database backed by hosted libSQL (production) or node:sqlite (local development).
 */
import { resolveStorage } from "./d1-compat";

const storage = resolveStorage(process.env as unknown as Record<string, unknown>);

export const runtimeBindings = new Proxy({} as Record<string, unknown>, {
  get(_target, property: string) {
    if (property === "DB") return storage.database ?? undefined;
    if (property === "QUEUEPROOF_STORAGE_BACKEND") return storage.backend;
    if (property === "QUEUEPROOF_STORAGE_DETAIL") return storage.detail;
    return (process.env as Record<string, unknown>)[property];
  },
  has(_target, property: string) {
    if (property === "DB") return storage.database !== null;
    return property in process.env;
  },
});

export const storageBackend = storage.backend;
export const storageDetail = storage.detail;
