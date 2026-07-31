import { noStoreJson } from "../../lib/server/api";
import { requireDb, runtimeEnv } from "../../lib/server/runtime";
import { audit, ensureCoreSchema } from "../../lib/server/store";
import { sha256 } from "../../packages/security/src";
import { createWorkspaceMcpHandler } from "../../packages/mcp/src/server";

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

async function serve(request: Request) {
  const runtime = runtimeEnv();
  const configuredToken = runtime.QUEUEPROOF_MCP_TOKEN;
  const configuredWorkspaceId = runtime.QUEUEPROOF_MCP_WORKSPACE_ID;
  if (!runtime.DB && (!configuredToken || !configuredWorkspaceId)) {
    return noStoreJson(
      { error: "Remote MCP authentication is not configured for this deployment." },
      { status: 503 },
    );
  }
  const origin = request.headers.get("origin");
  const requestUrl = new URL(request.url);
  if (origin && new URL(origin).origin !== requestUrl.origin) {
    return noStoreJson({ error: "Origin is not allowed." }, { status: 403 });
  }
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  let workspaceId: string | null = null;
  let clientId = "queueproof-static-client";
  let scopes = ["queueproof:read", "queueproof:propose", "queueproof:sync"];
  if (token && runtime.DB) {
    await ensureCoreSchema();
    const row = await requireDb().prepare(
      `SELECT mt.workspace_id AS workspaceId, mt.client_id AS clientId, mt.scopes_json AS scopesJson
       FROM mcp_tokens mt
       WHERE mt.token_hash = ? AND mt.revoked_at IS NULL AND mt.expires_at > CURRENT_TIMESTAMP
       LIMIT 1`,
    ).bind(await sha256(token)).first<{ workspaceId: string; clientId: string; scopesJson: string }>();
    if (row) {
      workspaceId = row.workspaceId;
      clientId = row.clientId;
      scopes = JSON.parse(row.scopesJson) as string[];
      await requireDb().prepare(
        `UPDATE mcp_clients SET last_handshake_at = COALESCE(last_handshake_at, CURRENT_TIMESTAMP),
         last_tool_call_at = CURRENT_TIMESTAMP, status = 'connected', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      ).bind(clientId).run();
    }
  }
  if (!workspaceId && token && configuredToken && configuredWorkspaceId && await constantTimeEqual(token, configuredToken)) {
    workspaceId = configuredWorkspaceId;
  }
  if (!token || !workspaceId) {
    return new Response(JSON.stringify({ error: "invalid_token" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "WWW-Authenticate": "Bearer",
      },
    });
  }
  const handler = createWorkspaceMcpHandler(workspaceId, scopes);
  const response = await handler.fetch(request, {
    authInfo: {
      token: "[validated]",
      clientId,
      scopes,
      resource: new URL(`${requestUrl.origin}${requestUrl.pathname}`),
    },
  });
  if (runtime.DB) {
    await audit({ workspaceId, actorId: `mcp:${clientId}`, operation: "mcp.request",
      targetType: "mcp_client", targetId: clientId, outcome: response.ok ? "success" : "failure",
      metadata: { method: request.method, status: response.status, scopes } });
  }
  return response;
}

export const GET = serve;
export const POST = serve;
export const DELETE = serve;
