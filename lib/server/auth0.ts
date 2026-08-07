import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { runtimeEnv } from "./runtime";

export type QueueProofAuthMode = "legacy" | "hybrid" | "auth0";

export type Auth0Config = {
  domain: string;
  issuer: string;
  clientId: string;
  clientSecret: string;
  secret: string;
  appBaseUrl?: string;
};

const HTTPS_URL = /^https:\/\//i;

function value(env: Record<string, unknown>, key: string): string {
  return typeof env[key] === "string" ? String(env[key]).trim() : "";
}

/**
 * Auth0 domains are configuration, never token-controlled input. Normalising once keeps
 * web sessions, JWT validation, and protected-resource metadata on the same issuer.
 */
export function normaliseAuth0Domain(raw: string): string {
  const withoutProtocol = raw.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  if (!withoutProtocol || !/^[a-z0-9.-]+(?::\d+)?$/i.test(withoutProtocol)) return "";
  return withoutProtocol.toLowerCase();
}

export function queueProofAuthMode(
  env: Record<string, unknown> = runtimeEnv() as Record<string, unknown>,
): QueueProofAuthMode {
  const configured = value(env, "QUEUEPROOF_AUTH_MODE");
  if (configured === "legacy" || configured === "hybrid" || configured === "auth0") {
    return configured;
  }

  // A complete Auth0 set is enough to select the safe hosted identity path in production.
  // Development keeps the hybrid migration default so an operator can deliberately retire the
  // legacy owner flow after testing. Explicit production hybrid/legacy modes are rejected by the
  // runtime validator; this default only prevents a complete integration from crashing because
  // an otherwise redundant mode variable was omitted.
  if (auth0Config(env)) {
    const production =
      value(env, "NODE_ENV") === "production" || value(env, "VERCEL_ENV") === "production";
    return production ? "auth0" : "hybrid";
  }
  return "legacy";
}

export function auth0Config(
  env: Record<string, unknown> = runtimeEnv() as Record<string, unknown>,
): Auth0Config | null {
  const domain = normaliseAuth0Domain(value(env, "AUTH0_DOMAIN"));
  const clientId = value(env, "AUTH0_CLIENT_ID");
  const clientSecret = value(env, "AUTH0_CLIENT_SECRET");
  const secret = value(env, "AUTH0_SECRET");
  if (!domain || !clientId || !clientSecret || !/^[a-f0-9]{64}$/i.test(secret)) return null;

  const explicitBaseUrl = value(env, "APP_BASE_URL") || value(env, "QUEUEPROOF_BASE_URL");
  const productionBaseUrl = value(env, "VERCEL_ENV") === "production"
    ? "https://queueproof.vercel.app"
    : "";
  const appBaseUrl = explicitBaseUrl || productionBaseUrl;
  return {
    domain,
    issuer: `https://${domain}/`,
    clientId,
    clientSecret,
    secret,
    ...(appBaseUrl && HTTPS_URL.test(appBaseUrl) ? { appBaseUrl: appBaseUrl.replace(/\/+$/, "") } : {}),
  };
}

export function auth0WebEnabled(
  env: Record<string, unknown> = runtimeEnv() as Record<string, unknown>,
): boolean {
  const mode = queueProofAuthMode(env);
  return (mode === "hybrid" || mode === "auth0") && Boolean(auth0Config(env));
}

export function legacyOwnerSignInEnabled(
  env: Record<string, unknown> = runtimeEnv() as Record<string, unknown>,
): boolean {
  const production = value(env, "NODE_ENV") === "production" || value(env, "VERCEL_ENV") === "production";
  // A complete production Auth0 boundary retires the shared deployment-owner secret even
  // before startup validation reports a stale hybrid configuration.
  if (production && auth0Config(env)) return false;
  const explicit = value(env, "QUEUEPROOF_LEGACY_OWNER_SIGNIN");
  if (explicit === "true") return true;
  if (explicit === "false") return false;
  return queueProofAuthMode(env) !== "auth0";
}

let cached: { key: string; client: Auth0Client } | null = null;

/** Return the SDK client only for a complete, enabled configuration. */
export function getAuth0Client(): Auth0Client | null {
  const config = auth0Config();
  if (!config || !auth0WebEnabled()) return null;
  const key = [config.domain, config.clientId, config.secret, config.appBaseUrl ?? ""].join("\0");
  if (cached?.key === key) return cached.client;

  const client = new Auth0Client({
    domain: config.domain,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    secret: config.secret,
    ...(config.appBaseUrl ? { appBaseUrl: config.appBaseUrl } : {}),
    signInReturnToPath: "/",
    enableAccessTokenEndpoint: false,
  });
  cached = { key, client };
  return client;
}
