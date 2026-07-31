import { apiError, noStoreJson } from "../../../../../lib/server/api";
import { hydraClientForWorkspace } from "../../../../../lib/server/hydradb-account";
import { requireRequestActor } from "../../../../../lib/server/identity";
import { requireDb } from "../../../../../lib/server/runtime";
import { audit, requireWorkspaceForUser } from "../../../../../lib/server/store";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRequestActor();
    const workspace = await requireWorkspaceForUser(actor.id);
    const workspaceId = String(workspace.id);
    const { id } = await context.params;
    const connector = await requireDb()
      .prepare(`SELECT hydradb_connector_id FROM connectors WHERE id = ? AND workspace_id = ? LIMIT 1`)
      .bind(id, workspaceId)
      .first<{ hydradb_connector_id: string }>();
    if (!connector) return noStoreJson({ ok: false, error: "Connector not found." }, { status: 404 });
    const response = await (await hydraClientForWorkspace(workspaceId)).syncConnector(
      connector.hydradb_connector_id,
    );
    if (!response.ok) {
      return noStoreJson({ ok: false, error: response.error }, { status: response.status || 502 });
    }
    await requireDb()
      .prepare(
        `UPDATE connectors SET state = 'initial_sync_requested', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      )
      .bind(id)
      .run();
    await audit({
      workspaceId,
      actorId: actor.id,
      operation: "connector.sync",
      targetType: "connector",
      targetId: id,
      outcome: "success",
      riskClass: "write",
      metadata: { requestId: response.requestId },
    });
    return noStoreJson({
      ok: true,
      state: "initial_sync_requested",
      queued: true,
      hydradb: response.data,
    });
  } catch (error) {
    return apiError(error);
  }
}

