import { apiError, noStoreJson } from "../../../../../lib/server/api";
import { hydraClientForWorkspace } from "../../../../../lib/server/hydradb-account";
import { requirePrivateControlActor, requireRequestActor } from "../../../../../lib/server/identity";
import { requireDb } from "../../../../../lib/server/runtime";
import { audit, createId, requireOwnerWorkspaceForUser } from "../../../../../lib/server/store";
import { genericProviderAdapter } from "../../../../../packages/connectors/src";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRequestActor();
    requirePrivateControlActor(actor, "Connector discovery");
    const workspace = await requireOwnerWorkspaceForUser(actor.id);
    const workspaceId = String(workspace.id);
    const { id } = await context.params;
    const connector = await requireDb()
      .prepare(`SELECT * FROM connectors WHERE id = ? AND workspace_id = ? LIMIT 1`)
      .bind(id, workspaceId)
      .first<Record<string, string>>();
    if (!connector) return noStoreJson({ ok: false, error: "Connector not found." }, { status: 404 });
    const client = await hydraClientForWorkspace(workspaceId);
    const response = await client.discoverResources(connector.hydradb_connector_id);
    if (!response.ok || !response.data) {
      return noStoreJson(
        { ok: false, error: response.error, diagnostics: { requestId: response.requestId } },
        { status: response.status >= 400 ? response.status : 502 },
      );
    }
    const resources = genericProviderAdapter.formatResources(response.data);
    const db = requireDb();
    for (const resource of resources) {
      await db
        .prepare(
          `INSERT INTO connector_resources
           (id, workspace_id, connector_id, external_resource_id, resource_type, display_name, status)
           VALUES (?, ?, ?, ?, ?, ?, 'discovered')
           ON CONFLICT(connector_id, external_resource_id) DO UPDATE SET
             resource_type = excluded.resource_type,
             display_name = excluded.display_name,
             updated_at = CURRENT_TIMESTAMP`,
        )
        .bind(createId("resource"), workspaceId, id, resource.id, resource.resourceType, resource.name)
        .run();
    }
    await db
      .prepare(`UPDATE connectors SET state = 'resources_discovered', updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(id)
      .run();
    await audit({
      workspaceId,
      actorId: actor.id,
      operation: "connector.discover",
      targetType: "connector",
      targetId: id,
      outcome: "success",
      riskClass: "write",
      metadata: { resourceCount: resources.length, requestId: response.requestId },
    });
    return noStoreJson({
      ok: true,
      resources,
      state: "resources_discovered",
      requestId: response.requestId,
    });
  } catch (error) {
    return apiError(error);
  }
}
