import { apiError, noStoreJson, readJson } from "../../../../../lib/server/api";
import { hydraClientForWorkspace } from "../../../../../lib/server/hydradb-account";
import { requirePrivateControlActor, requireRequestActor } from "../../../../../lib/server/identity";
import { requireDb } from "../../../../../lib/server/runtime";
import { audit, requireWorkspaceForUser } from "../../../../../lib/server/store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRequestActor();
    requirePrivateControlActor(actor, "Connector configuration");
    const workspace = await requireWorkspaceForUser(actor.id);
    const workspaceId = String(workspace.id);
    const { id } = await context.params;
    const payload = await readJson<{ resourceIds?: string[]; lookbackDays?: number }>(request);
    const resourceIds = [...new Set(payload.resourceIds ?? [])].filter(Boolean);
    if (resourceIds.length === 0) {
      return noStoreJson({ ok: false, error: "Select at least one discovered resource." }, { status: 400 });
    }
    const connector = await requireDb()
      .prepare(`SELECT * FROM connectors WHERE id = ? AND workspace_id = ? LIMIT 1`)
      .bind(id, workspaceId)
      .first<Record<string, string>>();
    if (!connector) return noStoreJson({ ok: false, error: "Connector not found." }, { status: 404 });
    const placeholders = resourceIds.map(() => "?").join(",");
    const rows = await requireDb()
      .prepare(
        `SELECT external_resource_id, resource_type, display_name
         FROM connector_resources
         WHERE connector_id = ? AND workspace_id = ? AND external_resource_id IN (${placeholders})`,
      )
      .bind(id, workspaceId, ...resourceIds)
      .all<Record<string, string>>();
    if (rows.results.length !== resourceIds.length) {
      return noStoreJson({ ok: false, error: "One or more selected resources were not discovered." }, { status: 400 });
    }
    const resources = rows.results.map((row: Record<string, string>) => ({
      resource_id: row.external_resource_id,
      resource_type: row.resource_type,
      name: row.display_name,
    }));
    const client = await hydraClientForWorkspace(workspaceId);
    const response = await client.configureConnector(
      connector.hydradb_connector_id,
      resources,
      Math.max(1, Math.min(365, payload.lookbackDays ?? 30)),
    );
    if (!response.ok) {
      return noStoreJson({ ok: false, error: response.error }, { status: response.status || 502 });
    }
    const db = requireDb();
    await db.batch([
      db
        .prepare(`UPDATE connector_resources SET selected = 0, updated_at = CURRENT_TIMESTAMP WHERE connector_id = ?`)
        .bind(id),
      db
        .prepare(
          `UPDATE connector_resources SET selected = 1, status = 'configured', updated_at = CURRENT_TIMESTAMP
           WHERE connector_id = ? AND external_resource_id IN (${placeholders})`,
        )
        .bind(id, ...resourceIds),
      db
        .prepare(`UPDATE connectors SET state = 'initial_sync_requested', last_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .bind(id),
    ]);
    await audit({
      workspaceId,
      actorId: actor.id,
      operation: "connector.configure",
      targetType: "connector",
      targetId: id,
      outcome: "success",
      riskClass: "write",
      metadata: { resourceCount: resourceIds.length, requestId: response.requestId },
    });
    return noStoreJson({
      ok: true,
      state: "initial_sync_requested",
      configured: resourceIds.length,
      message: "Resources saved. HydraDB started the initial sync/backfill.",
    });
  } catch (error) {
    return apiError(error);
  }
}
