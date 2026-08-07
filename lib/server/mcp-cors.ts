/**
 * Cross-origin policy for the MCP endpoints.
 *
 * The endpoints previously rejected any `Origin` that was not QueueProof's own, which
 * blocked exactly the clients they exist for: Claude and ChatGPT call `/mcp` from their
 * own web origins, so every browser-based connection died on a 403 before authentication
 * was even attempted.
 *
 * Relaxing this is safe here for a specific reason, not a general one: `/mcp` authorises
 * on a bearer token in the `Authorization` header and reads no cookie. Nothing about the
 * request is ambient, so a page on another origin gains nothing by making the browser
 * send it — it would still have to possess a token. `Access-Control-Allow-Credentials`
 * is deliberately never set, which keeps that property true.
 */

const TRUSTED_APEX_HOSTS = [
  "claude.ai",
  "anthropic.com",
  "chatgpt.com",
  "openai.com",
  "cursor.com",
  "vercel.app",
];

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** Suffix matching is anchored on a dot so `claude.ai.attacker.example` cannot pass. */
export function isTrustedMcpOrigin(origin: string, selfOrigin: string): boolean {
  if (origin === selfOrigin) return true;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname)) return true;
  if (url.protocol !== "https:") return false;
  return TRUSTED_APEX_HOSTS.some(
    (apex) => url.hostname === apex || url.hostname.endsWith(`.${apex}`),
  );
}

export function mcpCorsHeaders(origin: string | null): Record<string, string> {
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Expose-Headers": "WWW-Authenticate, Mcp-Session-Id, MCP-Protocol-Version",
    Vary: "Origin",
  };
}

export function mcpPreflight(origin: string | null): Response {
  return new Response(null, {
    status: 204,
    headers: {
      ...mcpCorsHeaders(origin),
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, Mcp-Session-Id, MCP-Protocol-Version, Last-Event-ID",
      "Access-Control-Max-Age": "86400",
    },
  });
}

/** Re-emit a handler response with CORS headers attached, preserving its stream body. */
export function withMcpCors(response: Response, origin: string | null): Response {
  if (!origin) return response;
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(mcpCorsHeaders(origin))) headers.set(key, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
