import { apiError, noStoreJson, readJson } from "../../../../lib/server/api";
import { hydraClientForWorkspace } from "../../../../lib/server/hydradb-account";
import {
  accessibleHydraConnectors,
  type AccessibleHydraConnector,
} from "../../../../lib/server/hydradb-connectors";
import {
  requirePrivateControlActor,
  requireRequestActor,
  type RequestActor,
} from "../../../../lib/server/identity";
import { requireDb } from "../../../../lib/server/runtime";
import {
  audit,
  createId,
  requireOwnerWorkspaceForUser,
} from "../../../../lib/server/store";

type ImportedConnectorRow = {
  hydradbConnectorId: string;
  state: string;
};

async function ownerContext(operation: string): Promise<{
  actor: RequestActor;
  workspaceId: string;
}> {
  const actor = await requireRequestActor();
  requirePrivateControlActor(actor, operation);
  const workspace = await requireOwnerWorkspaceForUser(actor.id);
  return { actor, workspaceId: String(workspace.id) };
}

async function upstreamConnectors(workspaceId: string) {
  const response = await (await hydraClientForWorkspace(workspaceId)).listConnectors();
  if (!response.ok) {
    throw noStoreJson(
      {
        ok: false,
        error: response.error ?? "HydraDB connector discovery failed.",
        diagnostics: { status: response.status, requestId: response.requestId },
      },
      { status: response.status >= 400 ? response.status : 502 },
    );
  }
  return {
    connectors: accessibleHydraConnectors(response.data),
    requestId: response.requestId,
    latencyMs: response.latencyMs,
  };
}

async function importedState(workspaceId: string): Promise<Map<string, string>> {
  const rows = await requireDb().prepare(
    `SELECT hydradb_connector_id AS hydradbConnectorId, state
     FROM connectors WHERE workspace_id = ? AND state != 'deleted'`,
  ).bind(workspaceId).all<ImportedConnectorRow>();
  return new Map(rows.results.map((row) => [row.hydradbConnectorId, row.state]));
}

function publicConnector(
  connector: AccessibleHydraConnector,
  imported: ReadonlyMap<string, string>,
) {
  const queueProofState = imported.get(connector.hydradbConnectorId) ?? null;
  return {
    ...connector,
    accountAccessVerified: true,
    imported: queueProofState !== null,
    queueProofState,
    retrievalEligible: queueProofState === "data_verified",
  };
}

/**
 * List connector references the attached HydraDB key is currently authorised to read.
 * This is account-access proof only; it never upgrades a connector to retrieval proof.
 */
export async function GET() {
  try {
    const { actor, workspaceId } = await ownerContext("Existing HydraDB connector discovery");
    const [upstream, imported] = await Promise.all([
      upstreamConnectors(workspaceId),
      importedState(workspaceId),
    ]);
    await audit({
      workspaceId,
      actorId: actor.id,
      operation: "hydradb.connectors.discover_existing",
      outcome: "success",
      metadata: {
        accessibleCount: upstream.connectors.length,
        requestId: upstream.requestId,
        latencyMs: upstream.latencyMs,
      },
    });
    return noStoreJson({
      ok: true,
      connectors: upstream.connectors.map((connector) => publicConnector(connector, imported)),
      proofBoundary: {
        accountAccess: "verified_by_attached_hydradb_key",
        retrieval: "requires_queueproof_scope_and_canary_verification",
      },
      requestId: upstream.requestId,
    });
  } catch (error) {
    return apiError(error);
  }
}

/**
 * Import selected references after re-reading the account-scoped HydraDB list.
 * Provider, database, collection, and account scope always come from HydraDB, never
 * from the request body, and imported rows remain ineligible for retrieval until the
 * existing discovery/configuration/canary lifecycle reaches `data_verified`.
 */
export async function POST(request: Request) {
  try {
    const { actor, workspaceId } = await ownerContext("Existing HydraDB connector import");
    const payload = await readJson<{ connectorIds?: unknown }>(request);
    if (!Array.isArray(payload.connectorIds)) {
      return noStoreJson(
        { ok: false, error: "Select one or more existing HydraDB connectors." },
        { status: 400 },
      );
    }
    if (
      payload.connectorIds.length === 0 ||
      payload.connectorIds.length > 50 ||
      payload.connectorIds.some((id) =>
        typeof id !== "string" || id.trim().length === 0 || id.trim().length > 500)
    ) {
      return noStoreJson(
        { ok: false, error: "Select between 1 and 50 valid connector identifiers." },
        { status: 400 },
      );
    }
    const connectorIds = [...new Set((payload.connectorIds as string[]).map((id) => id.trim()))];

    // Re-fetch immediately before the write. A stale browser list or a caller-supplied
    // identifier cannot attach a connector the current HydraDB account cannot access.
    const upstream = await upstreamConnectors(workspaceId);
    const byId = new Map(upstream.connectors.map((connector) => [connector.hydradbConnectorId, connector]));
    const selected = connectorIds.map((id) => byId.get(id));
    if (selected.some((connector) => !connector)) {
      return noStoreJson(
        {
          ok: false,
          error: "One or more connectors are not accessible through the attached HydraDB account.",
        },
        { status: 400 },
      );
    }

    const db = requireDb();
    const insertResults = await db.batch((selected as AccessibleHydraConnector[]).map((connector) => db.prepare(
      `INSERT OR IGNORE INTO connectors
       (id, workspace_id, hydradb_connector_id, provider, name, account_scope,
        database, collection, state, last_successful_sync_at, last_error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'connector_created', ?, ?)`,
    ).bind(
      createId("connector"),
      workspaceId,
      connector.hydradbConnectorId,
      connector.provider,
      connector.name,
      connector.accountScope,
      connector.database,
      connector.collection,
      connector.lastSuccessfulSyncAt,
      connector.lastError,
    )));
    const after = await importedState(workspaceId);
    const newlyImportedCount = insertResults.reduce(
      (total, result) => total + (Number(result.meta.changes ?? 0) > 0 ? 1 : 0),
      0,
    );
    await audit({
      workspaceId,
      actorId: actor.id,
      operation: "hydradb.connectors.import_existing",
      outcome: "success",
      riskClass: "write",
      metadata: {
        requestedCount: connectorIds.length,
        newlyImportedCount,
        providers: [...new Set((selected as AccessibleHydraConnector[]).map((item) => item.provider))],
        requestId: upstream.requestId,
      },
    });
    return noStoreJson(
      {
        ok: true,
        connectors: (selected as AccessibleHydraConnector[]).map((connector) =>
          publicConnector(connector, after)),
        newlyImportedCount,
        message:
          "Connector references imported. Choose their resource scope and pass QueueProof's canary before they can enter answers.",
      },
      { status: newlyImportedCount > 0 ? 201 : 200 },
    );
  } catch (error) {
    return apiError(error);
  }
}
