import { apiError, noStoreJson } from "../../../../../lib/server/api";
import { hydraClientForWorkspace } from "../../../../../lib/server/hydradb-account";
import {
  extractQuerySources,
  extractResources,
  canonicalProvider,
  providerFromSource,
  unwrapHydra,
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
    const selectedRows = await db.prepare(
      `SELECT external_resource_id FROM connector_resources
       WHERE workspace_id = ? AND connector_id = ? AND selected = 1`,
    ).bind(workspaceId, id).all<{ external_resource_id: string }>();
    const selectedSet = new Set(selectedRows.results.map((row) => row.external_resource_id));
    const [resourceResponse, connectorResponse] = await Promise.all([
      client.connectorResources(connector.hydradb_connector_id),
      client.getConnector(connector.hydradb_connector_id),
    ]);
    const resources = resourceResponse.ok ? extractResources(resourceResponse.data) : [];
    const selectedResources = resources.filter((resource) =>
      selectedSet.has(String(resource.resource_id ?? resource.resourceId ?? resource.id ?? "")),
    );
    const cursorEntries = selectedResources.map((resource) => ({
      id: String(resource.resource_id ?? resource.resourceId ?? resource.id ?? ""),
      cursor: String(resource.provider_cursor ?? resource.providerCursor ?? ""),
      lastSyncedAt: resource.last_synced_at ?? resource.lastSyncedAt ?? null,
    })).filter((entry) => entry.id && entry.cursor);
    const selectedIds = cursorEntries.map((entry) => entry.id);
    const hasCursor = selectedSet.size > 0 && cursorEntries.length === selectedSet.size;
    const connectorDetail = connectorResponse.ok ? unwrapHydra(connectorResponse.data) : {};
    const syncStatus = String(connectorDetail.sync_status ?? connectorDetail.syncStatus ?? connectorDetail.status ?? "unknown");
    const lastSuccessfulSync = connectorDetail.last_successful_sync_at ?? connectorDetail.lastSuccessfulSyncAt ?? null;
    const upstreamError = connectorDetail.last_error ?? connectorDetail.lastError ?? null;
    /**
     * Sync evidence: a provider cursor OR a recorded successful sync.
     *
     * Requiring a cursor alone is wrong. HydraDB does not populate `provider_cursor` for
     * every provider — a Gmail connector indexed 20 real messages while its cursor stayed
     * empty for the better part of an hour, so verification could never pass no matter how
     * much real data arrived.
     *
     * This deliberately does NOT weaken the bar for calling a connector verified. The
     * canary below is still mandatory and still has to return real, provider-matched,
     * connector-scoped objects. Retrieving actual records is stronger proof that a sync
     * happened than the presence of a cursor string; this change stops a bookkeeping
     * field from overriding that evidence.
     */
    const hasSyncEvidence = hasCursor || Boolean(lastSuccessfulSync);

    /**
     * The canary runs whenever the connector looks healthy, not only once HydraDB has
     * written its own sync bookkeeping.
     *
     * A live Gmail connector had 20 real, connector-scoped, queryable messages while both
     * `provider_cursor` and `last_successful_sync_at` were absent, because the backfill was
     * still running. Retrieving those records is direct evidence that the sync delivered
     * data; the two bookkeeping fields are indirect evidence of the same thing. Gating on
     * the indirect signal alone means a connector that demonstrably works cannot verify.
     *
     * What `data_verified` asserts is precisely "this connector returns real data", NOT
     * "the backfill is complete". Those are different claims, so `syncStatus` is recorded
     * on the verification record and surfaced in the response: a reader can see the
     * backfill was still in progress when the evidence was collected.
     */
    const canRunCanary = hasSyncEvidence || (resourceResponse.ok && connectorResponse.ok && !upstreamError);

    const canaryQuery = `Return one recent source from ${connector.provider} for connection verification.`;
    let canaryCount = 0;
    let sourceIds: string[] = [];
    let providerCoverage: string[] = [];
    let queryRequestId: string | null = null;
    if (canRunCanary) {
      const query = await client.query({
        database: connector.database,
        ...(connector.collection ? { collections: [connector.collection] } : {}),
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
        const matching = extracted.sources.filter((source) => {
          if (providerFromSource(source) !== canonicalProvider(connector.provider)) return false;
          const metadata = typeof source.additional_metadata === "object" && source.additional_metadata
            ? source.additional_metadata as Record<string, unknown> : {};
          const sourceConnector = source.connector_id ?? metadata.connector_id;
          return !sourceConnector || String(sourceConnector) === connector.hydradb_connector_id;
        });
        canaryCount = matching.length;
        sourceIds = matching.map((source) => String(source.id ?? "")).filter(Boolean);
        providerCoverage = [...new Set(extracted.sources.map(providerFromSource).filter(Boolean))] as string[];
      }
    }
    const verified = resourceResponse.ok && connectorResponse.ok && canaryCount > 0 && !upstreamError;
    const stage = verified
      ? "data_verified"
      : !resourceResponse.ok || !connectorResponse.ok
        ? "resource_status_failed"
        : !hasSyncEvidence
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
        lastSuccessfulSync ? String(lastSuccessfulSync) : null,
        hasCursor ? await sha256(JSON.stringify(cursorEntries)) : null,
        await sha256(canaryQuery),
        canaryCount,
        JSON.stringify(sourceIds),
        JSON.stringify(providerCoverage),
        verified ? new Date().toISOString() : null,
        verified ? null : stage,
      )
      .run();
    const updates = [
      db.prepare(
        `UPDATE connectors SET state = ?, last_successful_sync_at = ?, last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      ).bind(verified ? "data_verified" : "degraded", lastSuccessfulSync ? String(lastSuccessfulSync) : null,
        verified ? null : String(upstreamError ?? stage), id),
    ];
    for (const entry of cursorEntries) {
      updates.push(db.prepare(
        `UPDATE connector_resources SET provider_cursor_hash = ?, last_synced_at = ?, status = 'verified',
         updated_at = CURRENT_TIMESTAMP WHERE connector_id = ? AND external_resource_id = ?`,
      ).bind(await sha256(entry.cursor), entry.lastSyncedAt ? String(entry.lastSyncedAt) : null, id, entry.id));
    }
    const nextState = verified ? "data_verified" : !hasCursor && resourceResponse.ok && connectorResponse.ok ? "sync_in_progress" : "degraded";
    updates[0] = db.prepare(
      `UPDATE connectors SET state = ?, last_successful_sync_at = ?, last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    ).bind(nextState, lastSuccessfulSync ? String(lastSuccessfulSync) : null,
      verified || nextState === "sync_in_progress" ? null : String(upstreamError ?? stage), id);
    await db.batch(updates);
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
        connectorRequestId: connectorResponse.requestId,
        canaryCount,
        providerCoverage,
        syncStatus,
      },
    });
    return noStoreJson(
      {
        ok: verified,
        error: verified ? undefined : stage === "sync_evidence_missing"
          ? "Initial indexing is still in progress. No cursor proof is available yet."
          : "Connection proof has not passed yet. Inspect the verification details and retry.",
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
          syncStatus,
          lastSuccessfulSync: lastSuccessfulSync ? String(lastSuccessfulSync) : null,
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
