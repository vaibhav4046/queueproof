import { apiError, noStoreJson, readJson } from "../../../lib/server/api";
import { requirePrivateControlActor, requireRequestActor } from "../../../lib/server/identity";
import { requireDb, runtimeEnv } from "../../../lib/server/runtime";
import { audit, createId, ensureCoreSchema, requireWorkspaceForUser } from "../../../lib/server/store";
import { sha256 } from "../../../packages/security/src";

const allowedScopes = new Set(["queueproof:read", "queueproof:propose", "queueproof:sync"]);

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const encoded = btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  return `qp_live_${encoded}`;
}

export async function GET() {
  try {
    const actor = await requireRequestActor();
    const workspace = await requireWorkspaceForUser(actor.id);
    await ensureCoreSchema();
    const result = await requireDb().prepare(
      `SELECT mt.id, mt.client_id AS clientId, mc.client_type AS clientType,
              mt.scopes_json AS scopesJson, mt.expires_at AS expiresAt,
              mt.revoked_at AS revokedAt, mt.created_at AS createdAt,
              mc.last_handshake_at AS lastHandshakeAt, mc.last_tool_call_at AS lastToolCallAt
       FROM mcp_tokens mt LEFT JOIN mcp_clients mc ON mc.id = mt.client_id
       WHERE mt.workspace_id = ? ORDER BY mt.created_at DESC`,
    ).bind(String(workspace.id)).all<Record<string, unknown>>();
    return noStoreJson({ ok: true, tokens: result.results.map((row) => ({
      ...row, scopes: JSON.parse(String(row.scopesJson ?? "[]")), scopesJson: undefined,
    })) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireRequestActor();
    requirePrivateControlActor(actor, "MCP token minting");
    const workspace = await requireWorkspaceForUser(actor.id);
    const workspaceId = String(workspace.id);
    const payload = await readJson<{ clientType?: string; scopes?: string[]; expiresInDays?: number }>(request);
    const clientType = payload.clientType?.trim().toLowerCase() || "generic";
    const scopes = [...new Set(payload.scopes ?? ["queueproof:read"])].filter((scope) => allowedScopes.has(scope));
    if (!scopes.includes("queueproof:read")) scopes.unshift("queueproof:read");
    const days = Math.max(1, Math.min(90, payload.expiresInDays ?? 30));
    const expiresAt = new Date(Date.now() + days * 86_400_000).toISOString();
    const clientId = createId("mcp_client");
    const tokenId = createId("mcp_token");
    const token = randomToken();
    await ensureCoreSchema();
    const db = requireDb();
    await db.batch([
      db.prepare(
        `INSERT INTO mcp_clients (id, workspace_id, client_type, scopes_json)
         VALUES (?, ?, ?, ?)`,
      ).bind(clientId, workspaceId, clientType, JSON.stringify(scopes)),
      db.prepare(
        `INSERT INTO mcp_tokens (id, workspace_id, client_id, token_hash, audience, scopes_json, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).bind(tokenId, workspaceId, clientId, await sha256(token),
        runtimeEnv().QUEUEPROOF_MCP_AUDIENCE?.trim() || "queueproof-mcp", JSON.stringify(scopes), expiresAt),
    ]);
    await audit({ workspaceId, actorId: actor.id, operation: "mcp.token.create", targetType: "mcp_token",
      targetId: tokenId, outcome: "success", riskClass: "write", metadata: { clientType, scopes, expiresAt } });
    return noStoreJson({ ok: true, token, tokenId, clientId, clientType, scopes, expiresAt,
      warning: "Copy this token now. QueueProof stores only its hash and cannot show it again." }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const actor = await requireRequestActor();
    requirePrivateControlActor(actor, "MCP token revocation");
    const workspace = await requireWorkspaceForUser(actor.id);
    const { tokenId } = await readJson<{ tokenId?: string }>(request);
    if (!tokenId) return noStoreJson({ ok: false, error: "tokenId is required." }, { status: 400 });
    const result = await requireDb().prepare(
      `UPDATE mcp_tokens SET revoked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND workspace_id = ? AND revoked_at IS NULL`,
    ).bind(tokenId, String(workspace.id)).run();
    await audit({ workspaceId: String(workspace.id), actorId: actor.id, operation: "mcp.token.revoke",
      targetType: "mcp_token", targetId: tokenId, outcome: "success", riskClass: "write" });
    return noStoreJson({ ok: true, revoked: Number(result.meta.changes ?? 0) > 0 });
  } catch (error) {
    return apiError(error);
  }
}
