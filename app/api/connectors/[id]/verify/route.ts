import { apiError, noStoreJson } from "../../../../../lib/server/api";
import { hydraClientForWorkspace } from "../../../../../lib/server/hydradb-account";
import {
  extractQuerySources,
  extractResources,
  providerFromSource,
} from "../../../../../lib/server/hydradb-shapes";
import { requireRequestActor } from "../../../../../lib/server/identity";
import { requireDb } from "../../../../../lib/server/runtime";
import { audit, createId, requireWorkspaceForUser } from "../../../../../lib/server/store";
import { sha256 } from "../../../../../packages/security/src";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRequestActor();
    const workspace = await requireWorkspaceForUser(actor.id);
    const workspaceId = String(workspace.id);
    const { id } = await context.params;
    const db = requireDb();
    const connector = await db
      .prepare(`SELECT * FROM connectors WHERE id = ? AND workspace_id = ? LIMIT 1`)
      .bind(id, workspaceId)
      .first<Record<string, string>>();
    if (!connector) return noStoreJson({ ok: false, error: "Connector not found." }, { status: 404 });
    const client = await hydraClientForWorkspace(workspaceId);
    const resourceResponse = await client.connectorResources(connector.hydradb_connector_id);
    const resources = resourceResponse.ok ? extractResources(resourceResponse.data) : [];
    const selectedIds = resources
      .filter((resource) => resource.provider_cursor)
      .map((resource) => String(resource.resource_id ?? resource.id ?? ""))
      .filter(Boolean);
    const hasCursor = selectedIds.length > 0;
    const canaryQuery = `Return one recent source from ${connector.provider} for connection verification.`;
    let canaryCount = 0;
    let sourceIds: string[] = [];
    let providerCoverage: string[] = [];
    let queryRequestId: string | null = null;
    if (hasCursor) {
      const query = await client.query({
        database: connector.database,
        ...(connector.collection ? { collection: connector.collection } : {}),
        query: canaryQuery,
        type: "knowledge",
        query_by: "hybrid",
        mode: "fast",
        max_results: 5,
        query_apps: true,
        graph_context: false,
      });
      queryRequestId = query.requestId;
      if (query.ok) {
        const extracted = extractQuerySources(query.data);
        const matching = extracted.sources.filter(
          (source) => providerFromSource(source) === connector.provider.toLowerCase(),
        );
        canaryCount = matching.length;
        sourceIds = matching.map((source) => String(source.id ?? "")).filter(Boolean);
        providerCoverage = [...new Set(extracted.sources.map(providerFromSource).filter(Boolean))] as string[];
      }
    }
    const verified = resourceResponse.ok && hasCursor && canaryCount > 0;
    const stage = verified
      ? "data_verified"
      : !resourceResponse.ok
        ? "resource_status_failed"
        : !hasCursor
          ? "sync_evidence_missing"
          : "canary_failed";
    const verificationId = createId("verify");
    await db
      .prepare(
        `INSERT INTO connection_verifications
         (id, workspace_id, connector_id, provider, account_scope, resource_ids_json,
          verification_stage, last_successful_sync, cursor_evidence_hash, canary_query_hash,
          canary_result_count, source_ids_json, provider_coverage_json, verified_at,
          failure_reason, api_contract_version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '2')`,
      )
      .bind(
        verificationId,
        workspaceId,
        id,
        connector.provider,
        connector.account_scope ?? null,
        JSON.stringify(selectedIds),
        stage,
        connector.last_successful_sync_at ?? null,
        hasCursor ? await sha256(selectedIds.join("|")) : null,
        await sha256(canaryQuery),
        canaryCount,
        JSON.stringify(sourceIds),
        JSON.stringify(providerCoverage),
        verified ? new Date().toISOString() : null,
        verified ? null : stage,
      )
      .run();
    await db
      .prepare(
        `UPDATE connectors SET state = ?, last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      )
      .bind(verified ? "data_verified" : "degraded", verified ? null : stage, id)
      .run();
    await audit({
      workspaceId,
      actorId: actor.id,
      operation: "connector.verify",
      targetType: "connector",
      targetId: id,
      outcome: verified ? "success" : "failure",
      riskClass: "write",
      metadata: {
        stage,
        resourceRequestId: resourceResponse.requestId,
        queryRequestId,
        canaryCount,
        providerCoverage,
      },
    });
    return noStoreJson(
      {
        ok: verified,
        verification: {
          id: verificationId,
          stage,
          provider: connector.provider,
          resourcesTested: selectedIds,
          realObjectsRetrieved: canaryCount,
          sourceIds,
          providerCoverage,
          verifiedAt: verified ? new Date().toISOString() : null,
          syncCondition: hasCursor ? "cursor_present" : "cursor_missing",
          failureReason: verified ? null : stage,
          contractVersion: "2",
        },
      },
      { status: verified ? 200 : 409 },
    );
  } catch (error) {
    return apiError(error);
  }
}

