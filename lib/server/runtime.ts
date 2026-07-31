import { env } from "cloudflare:workers";

export type RuntimeEnv = {
  DB?: D1Database;
  FILES?: R2Bucket;
  QUEUEPROOF_ENCRYPTION_KEY?: string;
  QUEUEPROOF_TEST_MODE?: string;
  QUEUEPROOF_BASE_URL?: string;
  QUEUEPROOF_MCP_AUDIENCE?: string;
  QUEUEPROOF_MCP_TOKEN?: string;
  QUEUEPROOF_MCP_WORKSPACE_ID?: string;
  QUEUEPROOF_OAUTH_ISSUER?: string;
  QUEUEPROOF_ALLOW_LOCAL_IDENTITY?: string;
};

export function runtimeEnv(): RuntimeEnv {
  return env as unknown as RuntimeEnv;
}

export function requireDb(): D1Database {
  const db = runtimeEnv().DB;
  if (!db) throw new Error("QueueProof database binding is unavailable.");
  return db;
}

export function testModeEnabled(): boolean {
  return runtimeEnv().QUEUEPROOF_TEST_MODE === "true";
}
