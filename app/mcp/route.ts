import { noStoreJson } from "../../lib/server/api";
import { requireDb, runtimeEnv } from "../../lib/server/runtime";
import { audit, ensureCoreSchema } from "../../lib/server/store";
import { sha256 } from "../../packages/security/src";
import { createWorkspaceMcpHandler } from "../../packages/mcp/src/server";
import {
  authenticateSupabaseMcpToken,
  mcpAuthMode,
  mcpBearerChallenge,
  mcpOAuthConfig,
  type QueueProofMcpScope,
} from "../../lib/server/mcp-auth";
import { isTrustedMcpOrigin, mcpPreflight, withMcpCors } from "../../lib/server/mcp-cors";

const encoder = new TextEncoder();

async function constantTimeEqual(left: string, right: string) {
  const [leftDigest, rightDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const a = new Uint8Array(leftDigest);
  const b = new Uint8Array(rightDigest);
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

async function containsToolCall(request: Request) {
  if (request.method !== "POST") return false;
  try {
    const payload = await request.clone().json() as unknown;
    const messages = Array.isArray(payload) ? payload : [payload];
    return messages.some((message) =>
      Boolean(message) && typeof message === "object" &&
      (message as { method?: unknown }).method === "tools/call"
    );
  } catch {
    return false;
  }
}

/**
 * Outer shell: cross-origin policy and preflight, so every exit path from `handle`
 * carries the same CORS headers instead of each early return having to remember them.
 */
async function serve(request: Request) {
  const requestOrigin = request.headers.get("origin");
  const selfOrigin = new URL(request.url).origin;
  if (requestOrigin && !isTrustedMcpOrigin(requestOrigin, selfOrigin)) {
    return noStoreJson({ error: "Origin is not allowed." }, { status: 403 });
  }
  if (request.method === "OPTIONS") return mcpPreflight(requestOrigin);
  return withMcpCors(await handle(request), requestOrigin);
}

async function handle(request: Request) {
  const runtime = runtimeEnv();
  const authMode = mcpAuthMode();
  const oauth = mcpOAuthConfig();
  const configuredToken = runtime.QUEUEPROOF_MCP_TOKEN;
  const configuredWorkspaceId = runtime.QUEUEPROOF_MCP_WORKSPACE_ID;
  const expectedAudience = runtime.QUEUEPROOF_MCP_AUDIENCE?.trim() || "queueproof-mcp";
  if (!runtime.DB && (!configuredToken || !configuredWorkspaceId) && !oauth) {
    return noStoreJson(
      { error: "Remote MCP authentication is not configured for this deployment." },
      { status: 503 },
    );
  }
  const requestUrl = new URL(request.url);
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  let workspaceId: string | null = null;
  let clientId = "queueproof-static-client";
  let persistedClientId: string | null = null;
  let actorId = "mcp:queueproof-static-client";
  // Static compatibility credentials are read-only. Elevated capabilities are granted
  // only by a trusted Supabase custom claim or a persisted QueueProof token with explicit scopes.
  let scopes: QueueProofMcpScope[] = ["queueproof:read"];
  const jwtShaped = token.split(".").length === 3;
  // QueueProof now hosts its own authorization server, so a protected-resource URL always
  // exists. Emitting the full RFC 9728 challenge on every 401 — rather than a bare
  // `Bearer` when Supabase happened to be unconfigured — is what lets a client discover
  // where to authenticate instead of giving up on an unauthorized response it cannot act on.
  const authenticatedResource = oauth?.resource ?? `${requestUrl.origin}${requestUrl.pathname}`;

  // JWTs are handled by one strict path. A malformed or wrong-audience JWT must never
  // fall through and accidentally match a legacy/static credential.
  if (token && jwtShaped) {
    if (!oauth || authMode === "opaque") {
      return oauthUnauthorized(
        authenticatedResource,
        "invalid_token",
        "OAuth access is not enabled.",
      );
    }
    try {
      const authenticated = await authenticateSupabaseMcpToken(token, { config: oauth });
      workspaceId = authenticated.workspaceId;
      clientId = authenticated.clientId;
      persistedClientId = authenticated.persistedClientId;
      scopes = authenticated.scopes;
      actorId = `mcp:${authenticated.userId}`;
    } catch (error) {
      const insufficient = error instanceof Response && error.status === 403;
      return oauthUnauthorized(
        oauth.resource,
        insufficient ? "insufficient_scope" : "invalid_token",
        insufficient ? "Grant queueproof:read to use QueueProof." : "Sign in to QueueProof again.",
      );
    }
  }

  if (token && !jwtShaped && runtime.DB && authMode !== "supabase") {
    await ensureCoreSchema();
    const row = await requireDb().prepare(
      `SELECT mt.workspace_id AS workspaceId, mt.client_id AS clientId, mt.scopes_json AS scopesJson
       FROM mcp_tokens mt
       WHERE mt.token_hash = ? AND mt.audience = ?
         AND mt.revoked_at IS NULL AND datetime(mt.expires_at) > CURRENT_TIMESTAMP
       LIMIT 1`,
    ).bind(await sha256(token), expectedAudience).first<{
      workspaceId: string;
      clientId: string;
      scopesJson: string;
    }>();
    if (row) {
      workspaceId = row.workspaceId;
      clientId = row.clientId;
      persistedClientId = row.clientId;
      const parsedScopes = JSON.parse(row.scopesJson) as unknown;
      scopes = Array.isArray(parsedScopes)
        ? parsedScopes.filter((scope): scope is QueueProofMcpScope =>
            scope === "queueproof:read" || scope === "queueproof:propose" || scope === "queueproof:sync")
        : [];
      actorId = `mcp:${clientId}`;
      await requireDb().prepare(
        `UPDATE mcp_clients
         SET last_handshake_at = COALESCE(last_handshake_at, CURRENT_TIMESTAMP),
             status = 'connected', updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND workspace_id = ?`,
      ).bind(clientId, workspaceId).run();
    }
  }
  if (
    !workspaceId && token && !jwtShaped && authMode !== "supabase" &&
    configuredToken && configuredWorkspaceId && await constantTimeEqual(token, configuredToken)
  ) {
    workspaceId = configuredWorkspaceId;
  }
  if (!token || !workspaceId || !scopes.includes("queueproof:read")) {
    const insufficient = Boolean(token && workspaceId) && !scopes.includes("queueproof:read");
    return oauthUnauthorized(
      authenticatedResource,
      insufficient ? "insufficient_scope" : "invalid_token",
      insufficient
        ? "Grant queueproof:read to use QueueProof."
        : "Connect this client to QueueProof to continue.",
    );
  }
  const isToolCall = await containsToolCall(request);
  const handler = createWorkspaceMcpHandler(workspaceId, scopes);
  const response = await handler.fetch(request, {
    authInfo: {
      token: "[validated]",
      clientId,
      scopes,
      resource: new URL(authenticatedResource),
    },
  });
  if (runtime.DB && persistedClientId && isToolCall) {
    await requireDb().prepare(
      `UPDATE mcp_clients
       SET last_tool_call_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND workspace_id = ?`,
    ).bind(persistedClientId, workspaceId).run();
  }
  if (runtime.DB) {
    await audit({ workspaceId, actorId, operation: "mcp.request",
      targetType: "mcp_client", targetId: clientId, outcome: response.ok ? "success" : "failure",
      metadata: { method: request.method, status: response.status, scopes } });
  }
  return response;
}

function oauthUnauthorized(
  resource: string,
  error: "invalid_token" | "insufficient_scope",
  description: string,
) {
  return new Response(JSON.stringify({ error, error_description: description }), {
    status: 401,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "WWW-Authenticate": mcpBearerChallenge(resource, { error, description }),
    },
  });
}

export const GET = serve;
export const POST = serve;
export const DELETE = serve;
export const OPTIONS = serve;
