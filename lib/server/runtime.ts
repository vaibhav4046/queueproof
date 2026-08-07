import { runtimeBindings } from "./runtime-provider";

export type RuntimeEnv = {
  DB?: D1Database;
  FILES?: R2Bucket;
  QUEUEPROOF_ENCRYPTION_KEY?: string;
  QUEUEPROOF_TEST_MODE?: string;
  QUEUEPROOF_BASE_URL?: string;
  QUEUEPROOF_HYDRADB_BASE_URL?: string;
  /**
   * Optional deployment-wide HydraDB key. When set, a first-time operator reaches a
   * connected workspace in one click instead of pasting their own key. It stays
   * server-side: routes return its fingerprint, never the value.
   */
  QUEUEPROOF_SHARED_HYDRADB_API_KEY?: string;
  QUEUEPROOF_MCP_AUDIENCE?: string;
  QUEUEPROOF_MCP_TOKEN?: string;
  QUEUEPROOF_MCP_WORKSPACE_ID?: string;
  QUEUEPROOF_PUBLIC_WORKSPACE_ID?: string;
  QUEUEPROOF_AUTH_MODE?: string;
  QUEUEPROOF_LEGACY_OWNER_SIGNIN?: string;
  QUEUEPROOF_MCP_AUTH_MODE?: string;
  QUEUEPROOF_MCP_RESOURCE?: string;
  QUEUEPROOF_LINEAR_EXECUTION_WORKSPACE_ID?: string;
  QUEUEPROOF_ALLOW_LOCAL_IDENTITY?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_ANON_KEY?: string;
  OPENAI_APPS_CHALLENGE?: string;
  LINEAR_API_KEY?: string;
  /**
   * Set by Vercel to "production" | "preview" | "development". The OAuth issuer pins
   * itself to the canonical host on production so a deployment-alias request still
   * advertises the issuer clients actually discovered.
   */
  VERCEL_ENV?: string;
};

export function runtimeEnv(): RuntimeEnv {
  return runtimeBindings as RuntimeEnv;
}

export function requireDb(): D1Database {
  const db = runtimeEnv().DB;
  if (!db) throw new Error("QueueProof database binding is unavailable.");
  return db;
}

export function testModeEnabled(): boolean {
  return runtimeEnv().QUEUEPROOF_TEST_MODE === "true";
}
