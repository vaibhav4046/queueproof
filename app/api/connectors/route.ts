import { apiError, noStoreJson, readJson } from "../../../lib/server/api";
import { hydraClientForWorkspace } from "../../../lib/server/hydradb-account";
import { requirePrivateControlActor, requireRequestActor } from "../../../lib/server/identity";
import { requireDb } from "../../../lib/server/runtime";
import { audit, createId, requireWorkspaceForUser } from "../../../lib/server/store";
import { genericProviderAdapter } from "../../../packages/connectors/src";

export async function GET() {
  try {
    const actor = await requireRequestActor();
    const workspace = await requireWorkspaceForUser(actor.id);
    const result = await requireDb()
      .prepare(
        `SELECT c.id, c.hydradb_connector_id AS hydradbConnectorId, c.provider, c.name,
                c.account_scope AS accountScope, c.database, c.collection, c.state,
                c.last_successful_sync_at AS lastSuccessfulSyncAt, c.last_error AS lastError,
                (SELECT verification_stage FROM connection_verifications v
                 WHERE v.connector_id = c.id ORDER BY v.created_at DESC LIMIT 1) AS verificationStage,
                (SELECT canary_result_count FROM connection_verifications v
                 WHERE v.connector_id = c.id ORDER BY v.created_at DESC LIMIT 1) AS canaryResultCount,
                (SELECT verified_at FROM connection_verifications v
                 WHERE v.connector_id = c.id ORDER BY v.created_at DESC LIMIT 1) AS verifiedAt
         FROM connectors c WHERE c.workspace_id = ? AND c.state != 'deleted'
         ORDER BY c.provider, c.created_at`,
      )
      .bind(String(workspace.id))
      .all();
    return noStoreJson({ ok: true, connectors: result.results });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireRequestActor();
    requirePrivateControlActor(actor, "Connector creation");
    const workspace = await requireWorkspaceForUser(actor.id);
    const workspaceId = String(workspace.id);
    const payload = await readJson<{
      provider?: string;
      name?: string;
      database?: string;
      collection?: string;
      accountScope?: string;
      authType?: string;
      credentials?: Record<string, unknown>;
    }>(request);
    const provider = payload.provider?.trim().toLowerCase() ?? "";
    const name = payload.name?.trim() ?? provider;
    const database = payload.database?.trim() ?? "";
    if (!provider || !database || !payload.credentials) {
      return noStoreJson(
        { ok: false, error: "Provider, database, and contract-required credentials are required." },
        { status: 400 },
      );
    }
    const credentials = genericProviderAdapter.normaliseCredentials(payload.credentials);
    const client = await hydraClientForWorkspace(workspaceId);
    const response = await client.createConnector({
      provider,
      name,
      database,
      ...(payload.collection ? { collection: payload.collection.trim() } : {}),
      ...(payload.accountScope ? { provider_account_scope: payload.accountScope.trim() } : {}),
      ...(payload.authType ? { auth_type: payload.authType } : {}),
      credentials,
    });
    if (!response.ok || !response.data) {
      await audit({
        workspaceId,
        actorId: actor.id,
        operation: "connector.create",
        outcome: "failure",
        riskClass: "write",
        metadata: { provider, status: response.status, requestId: response.requestId },
      });
      return noStoreJson(
        { ok: false, error: response.error, diagnostics: { requestId: response.requestId } },
        { status: response.status >= 400 ? response.status : 502 },
      );
    }
    const raw = response.data;
    const hydradbConnectorId = String(raw.connector_id ?? raw.id ?? "");
    if (!hydradbConnectorId) {
      return noStoreJson(
        { ok: false, error: "HydraDB created no usable connector identifier." },
        { status: 502 },
      );
    }
    const connectorId = createId("connector");
    await requireDb()
      .prepare(
        `INSERT INTO connectors
         (id, workspace_id, hydradb_connector_id, provider, name, account_scope, database, collection, state)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'connector_created')`,
      )
      .bind(
        connectorId,
        workspaceId,
        hydradbConnectorId,
        provider,
        name,
        payload.accountScope?.trim() || null,
        database,
        payload.collection?.trim() || null,
      )
      .run();
    await audit({
      workspaceId,
      actorId: actor.id,
      operation: "connector.create",
      targetType: "connector",
      targetId: connectorId,
      outcome: "success",
      riskClass: "write",
      metadata: { provider, requestId: response.requestId },
    });
    return noStoreJson(
      {
        ok: true,
        connector: {
          id: connectorId,
          hydradbConnectorId,
          provider,
          state: "connector_created",
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
