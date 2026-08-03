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
import { assertRuntimeConfig } from "./runtime-config";

// Build previews can intentionally be unconfigured; an actual Vercel production
// runtime must fail closed before any route can accept traffic.
if (process.env.VERCEL_ENV === "production") {
  assertRuntimeConfig(process.env as unknown as Record<string, unknown>, { production: true });
}

const storage = resolveStorage(process.env as unknown as Record<string, unknown>);

export const runtimeBindings = new Proxy({} as Record<string, unknown>, {
  get(_target, property: string) {
    if (property === "DB") return storage.database ?? undefined;
    if (property === "QUEUEPROOF_STORAGE_BACKEND") return storage.backend;
    if (property === "QUEUEPROOF_STORAGE_DETAIL") return storage.detail;
    // FILES is an R2 bucket binding and cannot exist on this runtime. Without this guard
    // it fell through to process.env.FILES, so a plain environment variable FILES=1 made
    // health report an object-storage binding that is not there. A health check that can
    // be made to lie is worse than one that fails.
    if (property === "FILES") return undefined;
    return (process.env as Record<string, unknown>)[property];
  },
  has(_target, property: string) {
    if (property === "DB") return storage.database !== null;
    if (property === "FILES") return false;
    return property in process.env;
  },
});

export const storageBackend = storage.backend;
export const storageDetail = storage.detail;
