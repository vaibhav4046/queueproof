import { runtimeEnv } from "./runtime";
import { QUEUEPROOF_MCP_RESOURCE } from "./mcp-auth";
import { OAuthError } from "./oauth-provider";

/**
 * Shared HTTP concerns for the OAuth endpoints.
 *
 * Discovery, registration, and token exchange are all fetched cross-origin by MCP
 * clients running in a browser (claude.ai, chatgpt.com), so every one of them needs
 * permissive CORS. That is safe here precisely because none of these endpoints read a
 * cookie: identity comes from the request body or the bearer token, so a wildcard
 * origin cannot be turned into a confused-deputy request against a signed-in session.
 */

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, MCP-Protocol-Version",
  "Access-Control-Max-Age": "86400",
};

export function oauthJson(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return Response.json(body, {
    status,
    headers: {
      ...CORS_HEADERS,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extra,
    },
  });
}

export function oauthPreflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function oauthErrorResponse(error: unknown): Response {
  if (error instanceof OAuthError) {
    return oauthJson({ error: error.code, error_description: error.description }, error.status);
  }
  return oauthJson(
    { error: "server_error", error_description: "The authorization server could not complete the request." },
    500,
  );
}

/**
 * The issuer a client sees must match the one it discovered, or the token it receives
 * will be rejected as audience-mismatched. Production is pinned to the canonical host so
 * a request arriving via a Vercel deployment alias still advertises the stable issuer;
 * anywhere else, the request's own origin keeps local and preview flows self-consistent.
 */
export function canonicalOrigin(request: Request): string {
  const canonical = new URL(QUEUEPROOF_MCP_RESOURCE).origin;
  if (runtimeEnv().VERCEL_ENV === "production") return canonical;
  try {
    return new URL(request.url).origin;
  } catch {
    return canonical;
  }
}

/** Accept both `application/json` and `application/x-www-form-urlencoded` bodies. */
export async function readOAuthBody(request: Request): Promise<Record<string, string>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const parsed = (await request.json().catch(() => null)) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const flat: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "string") flat[key] = value;
    }
    return flat;
  }
  const form = await request.formData().catch(() => null);
  if (!form) return {};
  const flat: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") flat[key] = value;
  }
  return flat;
}
