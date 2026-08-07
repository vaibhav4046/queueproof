import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { runtimeEnv } from "./runtime";

export type QueueProofAuthMode = "legacy" | "hybrid" | "supabase";

export type SupabaseConfig = {
  url: string;
  publishableKey: string;
  issuer: string;
  jwksUrl: string;
  authorizationServer: string;
};

function value(env: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    if (typeof env[key] === "string" && String(env[key]).trim()) {
      return String(env[key]).trim();
    }
  }
  return "";
}

/**
 * Supabase is a configured trust root, never a token-controlled URL. Production accepts
 * HTTPS only; local development may use Supabase CLI on loopback HTTP.
 */
export function normaliseSupabaseUrl(raw: string): string {
  try {
    const url = new URL(raw.trim());
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
    if ((url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
        url.username || url.password || url.search || url.hash || url.pathname !== "/") {
      return "";
    }
    return url.origin;
  } catch {
    return "";
  }
}

export function supabaseConfig(
  env: Record<string, unknown> = runtimeEnv() as Record<string, unknown>,
): SupabaseConfig | null {
  const url = normaliseSupabaseUrl(value(env, "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"));
  const publishableKey = value(
    env,
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  );
  if (!url || publishableKey.length < 20) return null;
  return {
    url,
    publishableKey,
    issuer: `${url}/auth/v1`,
    jwksUrl: `${url}/auth/v1/.well-known/jwks.json`,
    authorizationServer: `${url}/auth/v1`,
  };
}

export function queueProofAuthMode(
  env: Record<string, unknown> = runtimeEnv() as Record<string, unknown>,
): QueueProofAuthMode {
  const configured = value(env, "QUEUEPROOF_AUTH_MODE");
  if (configured === "legacy" || configured === "hybrid" || configured === "supabase") {
    return configured;
  }
  if (supabaseConfig(env)) {
    const production = value(env, "NODE_ENV") === "production" || value(env, "VERCEL_ENV") === "production";
    return production ? "supabase" : "hybrid";
  }
  return "legacy";
}

export function supabaseWebEnabled(
  env: Record<string, unknown> = runtimeEnv() as Record<string, unknown>,
): boolean {
  const mode = queueProofAuthMode(env);
  return (mode === "hybrid" || mode === "supabase") && Boolean(supabaseConfig(env));
}

export function legacyOwnerSignInEnabled(
  env: Record<string, unknown> = runtimeEnv() as Record<string, unknown>,
): boolean {
  const production = value(env, "NODE_ENV") === "production" || value(env, "VERCEL_ENV") === "production";
  if (production && supabaseConfig(env)) return false;
  const explicit = value(env, "QUEUEPROOF_LEGACY_OWNER_SIGNIN");
  if (explicit === "true") return true;
  if (explicit === "false") return false;
  return queueProofAuthMode(env) !== "supabase";
}

/**
 * A request-bound server client. `getClaims()` verifies the JWT and is the only session
 * primitive used for authorization; `getSession()` is intentionally never trusted here.
 */
export async function createQueueProofServerClient() {
  const config = supabaseConfig();
  if (!config || !supabaseWebEnabled()) return null;
  const cookieStore = await cookies();
  return createServerClient(config.url, config.publishableKey, {
    auth: { flowType: "pkce" },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        for (const cookie of cookiesToSet) {
          try {
            cookieStore.set(cookie.name, cookie.value, cookie.options);
          } catch {
            // Server Components cannot always write cookies. The proxy performs refreshes;
            // route handlers remain writable and will persist callback/logout changes.
          }
        }
      },
    },
  });
}
