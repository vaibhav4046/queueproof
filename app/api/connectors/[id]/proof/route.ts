import { apiError, noStoreJson } from "../../../../../lib/server/api";
import { requireRequestActor } from "../../../../../lib/server/identity";
import { requireDb } from "../../../../../lib/server/runtime";
import { ensureCoreSchema, requireWorkspaceForUser } from "../../../../../lib/server/store";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRequestActor();
    const workspace = await requireWorkspaceForUser(actor.id);
    const workspaceId = String(workspace.id);
    const { id } = await context.params;
    await ensureCoreSchema();
    const connector = await requireDb().prepare(
      `SELECT id, hydradb_connector_id AS hydradbConnectorId, provider, name, account_scope AS accountScope,
              database, collection, state, last_successful_sync_at AS lastSuccessfulSyncAt,
              last_error AS lastError, updated_at AS updatedAt
       FROM connectors WHERE id = ? AND workspace_id = ? LIMIT 1`,
    ).bind(id, workspaceId).first();
    if (!connector) return noStoreJson({ ok: false, error: "Connector not found." }, { status: 404 });
    const [verification, resources] = await Promise.all([
      requireDb().prepare(
        `SELECT id, verification_stage AS stage, resource_ids_json AS resourceIdsJson,
                last_successful_sync AS lastSuccessfulSync, cursor_evidence_hash AS cursorEvidenceHash,
                canary_result_count AS canaryResultCount, source_ids_json AS sourceIdsJson,
                provider_coverage_json AS providerCoverageJson, verified_at AS verifiedAt,
                failure_reason AS failureReason, created_at AS createdAt
         FROM connection_verifications WHERE workspace_id = ? AND connector_id = ?
         ORDER BY created_at DESC LIMIT 1`,
      ).bind(workspaceId, id).first<Record<string, unknown>>(),
      requireDb().prepare(
        `SELECT external_resource_id AS id, resource_type AS resourceType, display_name AS name,
                selected, status, provider_cursor_hash AS cursorHash, last_synced_at AS lastSyncedAt
         FROM connector_resources WHERE workspace_id = ? AND connector_id = ? ORDER BY display_name`,
      ).bind(workspaceId, id).all(),
    ]);
    const proof = verification ? {
      ...verification,
      resourceIds: JSON.parse(String(verification.resourceIdsJson ?? "[]")),
      sourceIds: JSON.parse(String(verification.sourceIdsJson ?? "[]")),
      providerCoverage: JSON.parse(String(verification.providerCoverageJson ?? "[]")),
      resourceIdsJson: undefined, sourceIdsJson: undefined, providerCoverageJson: undefined,
    } : null;
    return noStoreJson({ ok: true, connector, verification: proof, resources: resources.results });
  } catch (error) {
    return apiError(error);
  }
}
