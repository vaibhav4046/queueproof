import { getRequestActor, signInConfigured } from "./identity";
import { requireDb, runtimeEnv } from "./runtime";
import { ensureCoreSchema, workspaceForUser } from "./store";
import { hydraAccountForWorkspace } from "./hydradb-account";
import { listQueueForWorkspace } from "./queue";

/**
 * Single source of truth for "what should the user see right now".
 *
 * Both the server-rendered page and GET /api/workspace derive from this, so the shell
 * that arrives in the HTML already matches what the client would compute. Previously the
 * page rendered a client component that unconditionally showed a boot screen and only
 * then fetched state, so a crawler, a no-JS client, or anyone whose request stalled saw
 * "Establishing workspace trust boundary…" indefinitely.
 *
 * The result is a discriminated union rather than a bag of nullable fields: every state
 * the product can legitimately be in is named, so no screen has to infer its situation
 * from a combination of nulls.
 */
export type WorkspaceView =
  | { kind: "storage_unconfigured"; detail: string }
  | { kind: "sign_in_required"; signInConfigured: boolean }
  | { kind: "no_workspace"; actor: ActorView }
  | {
      kind: "ready";
      actor: ActorView;
       workspace: WorkspaceSummary;
       hydradb: HydraSummary;
       evidence: PublicEvidenceSummary;
      /** Latest generated priority queue; keeps the /queue first paint identical to the API. */
      queue: Awaited<ReturnType<typeof listQueueForWorkspace>>;
      /** Surfaced so an ephemeral deployment can never be mistaken for a durable one. */
      storageBackend: string;
    };

export type ActorView = { displayName: string; localDevelopment: boolean; publicAccess: boolean };

export type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  mode: string;
};

export type HydraSummary = {
  configured: boolean;
  verifiedAt: string | null;
  fingerprint: string | null;
};

/** Safe evidence state for the server-rendered shell; credentials and source content never cross this boundary. */
export type PublicEvidenceSummary = {
  connectors: Array<{
    id: string; hydradbConnectorId: string; provider: string; name: string;
    state: string; database: string; collection: string | null;
    verificationStage: string | null; canaryResultCount: number | null;
    verifiedAt: string | null; lastSuccessfulSyncAt: string | null; lastError: string | null;
  }>;
  documents: Array<{
    id: string; filename: string; mime: string; byteSize: number; contentHash: string;
    database: string | null; hydradbSourceId: string | null; pageCount: number | null;
    indexedAt: string | null; processingDurationMs: number | null;
    stage: string; error: string | null; createdAt: string;
  }>;
};

export async function loadWorkspaceView(): Promise<WorkspaceView> {
  const runtime = runtimeEnv() as Record<string, unknown>;

  if (!runtime.DB) {
    return {
      kind: "storage_unconfigured",
      detail:
        typeof runtime.QUEUEPROOF_STORAGE_DETAIL === "string"
          ? runtime.QUEUEPROOF_STORAGE_DETAIL
          : "No durable storage is configured for this deployment.",
    };
  }

  const actor = await getRequestActor();
  if (!actor) {
    return { kind: "sign_in_required", signInConfigured: signInConfigured() };
  }

  await ensureCoreSchema();
  const workspace = await workspaceForUser(actor.id);
  const actorView: ActorView = {
    displayName: actor.displayName,
    localDevelopment: actor.localDevelopment,
    publicAccess: actor.id === "user:public-access",
  };

  if (!workspace) return { kind: "no_workspace", actor: actorView };

  const workspaceId = String(workspace.id);
  const [account, connectorRows, documentRows, queue] = await Promise.all([
    hydraAccountForWorkspace(workspaceId),
    requireDb().prepare(
      `SELECT c.id, c.hydradb_connector_id AS hydradbConnectorId, c.provider, c.name, c.state, c.database, c.collection,
              (SELECT verification_stage FROM connection_verifications v
               WHERE v.connector_id = c.id ORDER BY v.created_at DESC LIMIT 1) AS verificationStage,
              (SELECT canary_result_count FROM connection_verifications v
               WHERE v.connector_id = c.id ORDER BY v.created_at DESC LIMIT 1) AS canaryResultCount,
              (SELECT verified_at FROM connection_verifications v
               WHERE v.connector_id = c.id ORDER BY v.created_at DESC LIMIT 1) AS verifiedAt,
              c.last_successful_sync_at AS lastSuccessfulSyncAt, c.last_error AS lastError
       FROM connectors c WHERE c.workspace_id = ? AND c.state != 'deleted' ORDER BY c.updated_at DESC LIMIT 100`,
    ).bind(workspaceId).all<PublicEvidenceSummary["connectors"][number]>(),
    requireDb().prepare(
      `SELECT id, filename, mime, byte_size AS byteSize, content_hash AS contentHash,
              hydradb_database AS database, hydradb_source_id AS hydradbSourceId,
              page_count AS pageCount, indexed_at AS indexedAt,
              processing_duration_ms AS processingDurationMs, stage, error, created_at AS createdAt
       FROM documents WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 100`,
    ).bind(workspaceId).all<PublicEvidenceSummary["documents"][number]>(),
    listQueueForWorkspace(workspaceId),
  ]);
  return {
    kind: "ready",
    storageBackend:
      typeof runtime.QUEUEPROOF_STORAGE_BACKEND === "string"
        ? runtime.QUEUEPROOF_STORAGE_BACKEND
        : "unknown",
    actor: actorView,
    workspace: {
      id: String(workspace.id),
      name: String(workspace.name),
      slug: String(workspace.slug),
      mode: String(workspace.mode ?? "bring_your_own_hydradb"),
    },
    hydradb: {
      configured: Boolean(account),
      verifiedAt: (account?.verified_at as string | undefined) ?? null,
      fingerprint: (account?.key_fingerprint as string | undefined) ?? null,
    },
    evidence: { connectors: connectorRows.results ?? [], documents: documentRows.results ?? [] },
    queue,
  };
}
