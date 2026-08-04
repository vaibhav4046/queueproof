import { cookies } from "next/headers";
import { runtimeEnv } from "./runtime";

/**
 * Anonymous visitors share the public workspace but must not share one tiny request
 * bucket. This cookie contains only a random nonce and an expiry; it contains no IP,
 * user-agent, email, or other browser fingerprint.
 */
export const PUBLIC_CLIENT_COOKIE = "queueproof_public_client";

const COOKIE_VERSION = 1;
const COOKIE_TTL_MS = 30 * 24 * 60 * 60 * 1_000;
const encoder = new TextEncoder();

type PublicClientClaims = {
  v: 1;
  nonce: string;
  expiresAt: number;
};

function secret(): string | null {
  const value = (runtimeEnv() as Record<string, unknown>).QUEUEPROOF_ENCRYPTION_KEY;
  return typeof value === "string" && value.length >= 16 ? value : null;
}

async function hmac(payload: string, keyMaterial: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(`queueproof-public-client:${keyMaterial}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

export async function createPublicClientValue(
  nonce: string,
  expiresAt = Date.now() + COOKIE_TTL_MS,
): Promise<string | null> {
  const keyMaterial = secret();
  if (!keyMaterial) return null;
  const payload = JSON.stringify({
    v: COOKIE_VERSION,
    nonce,
    expiresAt,
  } satisfies PublicClientClaims);
  const encoded = Buffer.from(payload, "utf8").toString("base64url");
  return `${encoded}.${await hmac(encoded, keyMaterial)}`;
}

export async function verifyPublicClientValue(
  raw: string,
  nowMs = Date.now(),
): Promise<PublicClientClaims | null> {
  const keyMaterial = secret();
  if (!keyMaterial || !raw) return null;
  const separator = raw.lastIndexOf(".");
  if (separator <= 0 || separator === raw.length - 1) return null;
  const encoded = raw.slice(0, separator);
  const supplied = raw.slice(separator + 1);
  const expected = await hmac(encoded, keyMaterial);
  if (!timingSafeEqual(supplied, expected)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as
      Partial<PublicClientClaims> | null;
    if (
      !parsed ||
      parsed.v !== COOKIE_VERSION ||
      typeof parsed.nonce !== "string" ||
      !/^[a-f0-9]{32}$/i.test(parsed.nonce) ||
      typeof parsed.expiresAt !== "number" ||
      !Number.isFinite(parsed.expiresAt) ||
      nowMs >= parsed.expiresAt
    ) {
      return null;
    }
    return parsed as PublicClientClaims;
  } catch {
    return null;
  }
}

function randomNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Resolve the opaque actor id written to the durable limiter ledger. The raw random
 * cookie nonce is never persisted: a domain-separated HMAC produces the database key.
 * If the deployment has no signing secret or this is called outside a request context,
 * it safely falls back to the shared public bucket instead of trusting client input.
 */
export async function publicRateLimitBucketId(): Promise<string> {
  const keyMaterial = secret();
  if (!keyMaterial) return "user:public-access";

  try {
    const store = await cookies();
    let claims = await verifyPublicClientValue(store.get(PUBLIC_CLIENT_COOKIE)?.value ?? "");
    if (!claims) {
      claims = { v: COOKIE_VERSION, nonce: randomNonce(), expiresAt: Date.now() + COOKIE_TTL_MS };
      const value = await createPublicClientValue(claims.nonce, claims.expiresAt);
      if (!value) return "user:public-access";
      store.set(PUBLIC_CLIENT_COOKIE, value, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: Math.floor(COOKIE_TTL_MS / 1_000),
      });
    }

    const bucket = await hmac(`bucket:${claims.nonce}`, keyMaterial);
    return `public-client:${bucket.slice(0, 40)}`;
  } catch {
    // Unit tests and static render paths do not always have a mutable cookie store.
    return "user:public-access";
  }
}

