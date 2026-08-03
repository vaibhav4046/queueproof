import { headers, cookies } from "next/headers";
import { runtimeEnv } from "./runtime";

export type RequestActor = {
  id: string;
  email: string;
  displayName: string;
  localDevelopment: boolean;
};

/**
 * Public access is intentionally useful for the evidence demo, but it must not grant
 * anonymous control over credentials, connector spend, durable bearer tokens, uploads,
 * or external provider writes. Shared in-product queue/proposal state remains available;
 * control-plane mutations call this guard explicitly.
 */
export function requirePrivateControlActor(actor: RequestActor, operation = "This control-plane operation") {
  if (actor.id !== "user:public-access") return;
  throw new Response(
    `${operation} is disabled in the public sandbox. Sign in as the workspace owner to continue.`,
    { status: 403 },
  );
}

export const SESSION_COOKIE = "queueproof_session";

/**
 * Identity resolution.
 *
 * SECURITY HISTORY — this file previously granted a full workspace identity to
 * anyone who set an `oai-authenticated-user-email` request header, and to anyone
 * whose `Host` header merely *started with* "localhost" (so `localhost.attacker.example`
 * passed). That was survivable only while the Vercel deployment had no database
 * attached; once durable storage exists it is a complete account-takeover path
 * (read/revoke MCP tokens, overwrite the stored HydraDB credential).
 *
 * The gateway header is now trusted only when the deployment explicitly declares it
 * sits behind that gateway, local identity requires an explicit environment opt-in
 * rather than an attacker-controlled header, and a signed session cookie is the
 * mechanism for a normal hosted deployment.
 */

const encoder = new TextEncoder();

type SessionClaims = {
  v: 2;
  email: string;
  expiresAt: number;
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
}

function signingSecret(): string | null {
  const env = runtimeEnv() as Record<string, unknown>;
  const secret = env.QUEUEPROOF_ENCRYPTION_KEY;
  return typeof secret === "string" && secret.length >= 16 ? secret : null;
}

/** HMAC-SHA256 over the session payload, hex encoded. */
async function signPayload(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function createSessionValue(email: string, expiresAtMs: number): Promise<string | null> {
  const secret = signingSecret();
  if (!secret) return null;
  // A structured payload prevents an email containing the legacy `|` delimiter from
  // supplying the expiry field the verifier reads. The signature still covers every
  // byte, and the version gives us an unambiguous migration path.
  const payload = JSON.stringify({ v: 2, email, expiresAt: expiresAtMs } satisfies SessionClaims);
  const signature = await signPayload(payload, secret);
  return `${Buffer.from(payload, "utf8").toString("base64url")}.${signature}`;
}

function validSessionIdentity(email: string, expiresAt: number, nowMs: number): boolean {
  return (
    email.length <= 254 &&
    email.includes("@") &&
    Number.isFinite(expiresAt) &&
    nowMs < expiresAt
  );
}

function claimsFromPayload(payload: string): { email: string; expiresAt: number } | null {
  try {
    const parsed = JSON.parse(payload) as Partial<SessionClaims> | null;
    if (
      parsed &&
      parsed.v === 2 &&
      typeof parsed.email === "string" &&
      typeof parsed.expiresAt === "number"
    ) {
      return { email: parsed.email, expiresAt: parsed.expiresAt };
    }
    // A syntactically valid JSON object with another version is not a legacy cookie.
    if (parsed && typeof parsed === "object") return null;
  } catch {
    // Version 1 cookies used a delimiter payload and are handled below.
  }

  // Safe legacy compatibility: the server appended the real expiry after the final
  // delimiter. Reading the first delimiter let an email such as `a@b|4102444800000`
  // override that expiry. Reading the last delimiter preserves existing cookies while
  // making the appended server expiry authoritative.
  const separator = payload.lastIndexOf("|");
  if (separator <= 0 || separator === payload.length - 1) return null;
  return {
    email: payload.slice(0, separator),
    expiresAt: Number(payload.slice(separator + 1)),
  };
}

/** Verify a signed cookie value without depending on the Next.js cookie store. */
export async function verifySessionValue(
  raw: string,
  nowMs = Date.now(),
): Promise<RequestActor | null> {
  const secret = signingSecret();
  if (!secret) return null;
  if (!raw) return null;

  const separator = raw.lastIndexOf(".");
  if (separator <= 0) return null;

  const encodedPayload = raw.slice(0, separator);
  const providedSignature = raw.slice(separator + 1);

  let payload: string;
  try {
    payload = Buffer.from(encodedPayload, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const expectedSignature = await signPayload(payload, secret);
  if (!timingSafeEqual(providedSignature, expectedSignature)) return null;

  const claims = claimsFromPayload(payload);
  if (!claims || !validSessionIdentity(claims.email, claims.expiresAt, nowMs)) return null;

  return {
    id: `user:${claims.email.toLowerCase()}`,
    email: claims.email,
    displayName: claims.email,
    localDevelopment: false,
  };
}

async function actorFromSessionCookie(): Promise<RequestActor | null> {
  // Keep the no-session-secret path independent of Next's request context. This is also
  // the fail-closed behaviour used by tests and unconfigured preview deployments.
  if (!signingSecret()) return null;
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  return raw ? verifySessionValue(raw) : null;
}

/**
 * Trust the upstream identity header only when the deployment declares it is behind
 * a gateway that injects it and strips any client-supplied copy.
 */
async function actorFromTrustedGateway(): Promise<RequestActor | null> {
  const env = runtimeEnv() as Record<string, unknown>;
  if (env.QUEUEPROOF_TRUSTED_IDENTITY_PROXY !== "openai-sites") return null;

  const requestHeaders = await headers();
  const email = requestHeaders.get("oai-authenticated-user-email");
  if (!email) return null;

  const encodedName = requestHeaders.get("oai-authenticated-user-full-name");
  const encoding = requestHeaders.get("oai-authenticated-user-full-name-encoding");
  let displayName = email;
  if (encodedName && encoding === "percent-encoded-utf-8") {
    try {
      displayName = decodeURIComponent(encodedName);
    } catch {
      displayName = email;
    }
  }
  return { id: `user:${email.toLowerCase()}`, email, displayName, localDevelopment: false };
}

/**
 * Local development identity. Gated on an environment variable — never on the Host
 * header, which the client controls.
 *
 * Also refuses to activate in a production build. A stray
 * QUEUEPROOF_ALLOW_LOCAL_IDENTITY=true reaching a deployment would otherwise
 * authenticate every anonymous request as the workspace owner; this was observed
 * during testing when a local .env file was picked up by `next start`.
 */
function actorFromLocalOptIn(): RequestActor | null {
  if (process.env.NODE_ENV === "production") return null;
  if (runtimeEnv().QUEUEPROOF_ALLOW_LOCAL_IDENTITY !== "true") return null;
  return {
    id: "user:local-development",
    email: "local@queueproof.invalid",
    displayName: "Local workspace",
    localDevelopment: true,
  };
}

/**
 * Explicit public-demo mode. This is intentionally opt-in at deployment time: when
 * enabled, every anonymous visitor shares the evidence-demo actor. Sensitive control-
 * plane mutations are denied separately by requirePrivateControlActor(). It must never
 * become an accidental fallback.
 */
function actorFromPublicAccess(): RequestActor | null {
  const env = runtimeEnv() as Record<string, unknown>;
  if (env.QUEUEPROOF_PUBLIC_ACCESS !== "true") return null;
  return {
    id: "user:public-access",
    email: "public@queueproof.local",
    displayName: "Public workspace",
    localDevelopment: false,
  };
}

export async function getRequestActor(): Promise<RequestActor | null> {
  // Public demo mode is a deployment-wide routing decision. It intentionally wins over
  // stale cookies so returning judges land in the same shared demo as first-time users.
  const publicActor = actorFromPublicAccess();
  if (publicActor) return publicActor;
  return (
    (await actorFromSessionCookie()) ??
    (await actorFromTrustedGateway()) ??
    actorFromLocalOptIn()
  );
}

export async function requireRequestActor(): Promise<RequestActor> {
  const actor = await getRequestActor();
  if (!actor) throw new Response("Authentication required.", { status: 401 });
  return actor;
}

/** True when a hosted deployment has a way for a human to sign in. */
export function signInConfigured(): boolean {
  const env = runtimeEnv() as Record<string, unknown>;
  const raw = env.QUEUEPROOF_ACCESS_TOKEN;
  return typeof raw === "string" && raw.trim().length >= 16;
}

export function accessTokenMatches(candidate: string): boolean {
  const env = runtimeEnv() as Record<string, unknown>;
  const raw = env.QUEUEPROOF_ACCESS_TOKEN;
  if (typeof raw !== "string") return false;
  // Trimmed on both sides: a value set through a CLI pipe carries a trailing newline,
  // which would make every sign-in fail with a correct token and no useful signal.
  const expected = raw.trim();
  if (expected.length < 16) return false;
  return timingSafeEqual(candidate.trim(), expected);
}
