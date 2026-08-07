import { apiError, noStoreJson } from "../../../../../lib/server/api";
import { connectorProofFreshness } from "../../../../../lib/server/connector-proof";
import { requireRequestActor } from "../../../../../lib/server/identity";
import { requireDb } from "../../../../../lib/server/runtime";
import { ensureCoreSchema, requireWorkspaceForUser } from "../../../../../lib/server/store";
import {
  isPublicAccessActor,
  publicDtoForActor,
  publicStorageReference,
} from "../../../../../lib/server/public-dto";

type ConnectorResourceProof = {
  id: string;
  resourceType: string;
  name: string;
  selected: number;
  status: string;
  cursorHash: string | null;
  lastSyncedAt: string | null;
};

function stringArrayFromJson(value: unknown): string[] {
  try {
    const parsed = JSON.parse(String(value ?? "[]"));
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRequestActor();
    const workspace = await requireWorkspaceForUser(actor.id);
    const workspaceId = String(workspace.id);
    const publicProof = actor.id === "user:public-access";
    const { id } = await context.params;
    let connectorId = id;
    if (isPublicAccessActor(actor) && id.startsWith("public-connector-")) {
      const candidates = await requireDb().prepare(
        `SELECT id FROM connectors WHERE workspace_id = ? AND state != 'deleted' ORDER BY created_at LIMIT 500`,
      ).bind(workspaceId).all<{ id: string }>();
      connectorId = candidates.results.find((candidate) =>
        publicStorageReference(workspaceId, "connector", candidate.id) === id)?.id ?? "";
    }
    if (!connectorId) return noStoreJson({ ok: false, error: "Connector not found." }, { status: 404 });
    await ensureCoreSchema();
    const connector = await requireDb().prepare(
      `SELECT id, hydradb_connector_id AS hydradbConnectorId, provider, name, account_scope AS accountScope,
              database, collection, state, last_successful_sync_at AS lastSuccessfulSyncAt,
              last_error AS lastError, updated_at AS updatedAt
       FROM connectors WHERE id = ? AND workspace_id = ? AND state != 'deleted' LIMIT 1`,
    ).bind(connectorId, workspaceId).first();
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
      ).bind(workspaceId, connectorId).first<Record<string, unknown>>(),
      requireDb().prepare(
        `SELECT external_resource_id AS id, resource_type AS resourceType, display_name AS name,
                selected, status, provider_cursor_hash AS cursorHash, last_synced_at AS lastSyncedAt
         FROM connector_resources WHERE workspace_id = ? AND connector_id = ?
         ${publicProof ? "AND selected = 1 AND status = 'verified'" : ""}
         ORDER BY display_name`,
      ).bind(workspaceId, connectorId).all<ConnectorResourceProof>(),
    ]);
    const proof = verification ? (() => {
      const resourceIds = stringArrayFromJson(verification.resourceIdsJson);
      const visibleResourceIds = new Set(resources.results.map((resource) => resource.id));
      return {
        ...verification,
        // The SQL predicate is the primary disclosure boundary. Intersecting receipt IDs
        // with the visible rows prevents a stale or malformed receipt from naming a
        // resource the public sandbox is not allowed to enumerate.
        resourceIds: publicProof
          ? resourceIds.filter((resourceId) => visibleResourceIds.has(resourceId))
          : resourceIds,
        sourceIds: stringArrayFromJson(verification.sourceIdsJson),
        providerCoverage: stringArrayFromJson(verification.providerCoverageJson),
        resourceIdsJson: undefined,
        sourceIdsJson: undefined,
        providerCoverageJson: undefined,
      };
    })() : null;
    const response = {
      ok: true,
      connector,
      verification: proof,
      proofFreshness: connectorProofFreshness(verification?.verifiedAt),
      resources: publicProof
        ? resources.results.map((resource) => ({
          ...resource,
          // Some providers use the external resource id as the fallback display name.
          // Keep the scope understandable without repeating the raw id in a safe field.
          name: resource.name === resource.id ? `${resource.resourceType} scope` : resource.name,
        }))
        : resources.results,
    };
    return noStoreJson(publicDtoForActor(actor, response, {
      workspaceId,
      referenceAliases: [{
        raw: connectorId,
        public: publicStorageReference(workspaceId, "connector", connectorId),
      }],
    }));
  } catch (error) {
    return apiError(error);
  }
}
