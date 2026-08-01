import { headers, cookies } from "next/headers";
import { runtimeEnv } from "./runtime";

export type RequestActor = {
  id: string;
  email: string;
  displayName: string;
  localDevelopment: boolean;
};

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
  const payload = `${email}|${expiresAtMs}`;
  const signature = await signPayload(payload, secret);
  return `${Buffer.from(payload, "utf8").toString("base64url")}.${signature}`;
}

async function actorFromSessionCookie(): Promise<RequestActor | null> {
  const secret = signingSecret();
  if (!secret) return null;

  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
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

  const [email, expiresAtRaw] = payload.split("|");
  const expiresAt = Number(expiresAtRaw);
  if (!email || !Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;

  return {
    id: `user:${email.toLowerCase()}`,
    email,
    displayName: email,
    localDevelopment: false,
  };
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

export async function getRequestActor(): Promise<RequestActor | null> {
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
