import { apiError, noStoreJson, readJson } from "../../../../lib/server/api";
import { encryptSecret, secretFingerprint } from "../../../../lib/server/crypto";
import {
  hydraAccountForWorkspace,
  hydraClientForWorkspace,
  hydraDbBaseUrlForAttach,
} from "../../../../lib/server/hydradb-account";
import {
  accessibleHydraConnectors,
  type AccessibleHydraConnector,
} from "../../../../lib/server/hydradb-connectors";
import { requirePrivateControlActor, requireRequestActor } from "../../../../lib/server/identity";
import { requireDb, runtimeEnv } from "../../../../lib/server/runtime";
import {
  audit,
  createId,
  ensureCoreSchema,
  workspaceForUser,
} from "../../../../lib/server/store";
import { genericProviderAdapter } from "../../../../packages/connectors/src";
import { HydraDbClient } from "../../../../packages/hydradb/src/client";

/**
 * One-call onboarding: workspace, HydraDB attachment, connector adoption, resource
 * discovery, full-scope configuration, and initial sync.
 *
 * Every step already exists as its own audited route. This endpoint runs the same
 * server-side sequence so a new operator reaches a queryable workspace in one action
 * instead of nine. It grants no capability the individual routes do not: the workspace
 * is resolved from the authenticated actor, provider/database/collection/account-scope
 * always come back from HydraDB rather than the request body, and adopted connectors
 * still have to clear the canary check before retrieval will read them.
 */

/** Concurrent per-connector pipelines. HydraDB is a shared upstream; do not flood it. */
const PIPELINE_CONCURRENCY = 4;

/** Connector references adopted in a single call. Matches the import route's ceiling. */
const MAX_ADOPTED_CONNECTORS = 50;

type ConnectorOutcome = {
  id: string | null;
  hydradbConnectorId: string;
  provider: string;
  name: string;
  adopted: boolean;
  resourcesDiscovered: number;
  resourcesConfigured: number;
  syncQueued: boolean;
  state: string;
  error: string | null;
};

type HydraAttachment = {
  source: "existing_account" | "supplied_key" | "deployment_shared_key";
  fingerprint: string;
  baseUrl: string;
};

function workspaceNameForActor(email: string, displayName: string | null | undefined): string {
  const fromName = displayName?.trim();
  if (fromName && fromName.length >= 2) return fromName.slice(0, 80);
  const localPart = email.split("@")[0]?.replace(/[._-]+/g, " ").trim();
  if (localPart && localPart.length >= 2) return `${localPart.slice(0, 70)} workspace`;
  return "QueueProof workspace";
}

async function ensureWorkspace(actorId: string, email: string, displayName?: string | null) {
  await ensureCoreSchema();
  const existing = await workspaceForUser(actorId);
  if (existing) return { id: String(existing.id), name: String(existing.name), created: false };

  const db = requireDb();
  const workspaceId = createId("ws");
  const name = workspaceNameForActor(email, displayName);
  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)}-${workspaceId.slice(-6)}`;
  await db.batch([
    db
      .prepare(`INSERT OR IGNORE INTO users (id, email, display_name) VALUES (?, ?, ?)`)
      .bind(actorId, email, displayName ?? null),
    db.prepare(`INSERT INTO workspaces (id, slug, name) VALUES (?, ?, ?)`).bind(workspaceId, slug, name),
    db
      .prepare(`INSERT INTO workspace_members (id, workspace_id, user_id, role) VALUES (?, ?, ?, 'owner')`)
      .bind(createId("member"), workspaceId, actorId),
  ]);
  await audit({
    workspaceId,
    actorId,
    operation: "workspace.create",
    targetType: "workspace",
    targetId: workspaceId,
    outcome: "success",
    riskClass: "write",
    metadata: { via: "connect_all" },
  });
  return { id: workspaceId, name, created: true };
}

/**
 * Attach a HydraDB credential without ever handing one to the browser.
 *
 * Preference order is deliberate. An already-verified workspace account wins so a repeat
 * click is idempotent. A key the operator supplied in this request comes next. The
 * deployment-wide key is last and is server-side only: it lets a first-time visitor reach
 * a working workspace in one click, and the response carries a fingerprint, never the key.
 */
async function ensureHydraAttachment(
  workspaceId: string,
  actorId: string,
  suppliedKey: string | null,
): Promise<HydraAttachment | null> {
  const existing = await hydraAccountForWorkspace(workspaceId);
  if (existing && existing.status === "verified") {
    return {
      source: "existing_account",
      fingerprint: String(existing.key_fingerprint),
      baseUrl: String(existing.base_url),
    };
  }

  const sharedKey = runtimeEnv().QUEUEPROOF_SHARED_HYDRADB_API_KEY?.trim() || null;
  const apiKey = suppliedKey && suppliedKey.length >= 12 ? suppliedKey : sharedKey;
  if (!apiKey || apiKey.length < 12) return null;

  const configuredBaseUrl = runtimeEnv().QUEUEPROOF_HYDRADB_BASE_URL;
  const baseUrl = hydraDbBaseUrlForAttach(
    null,
    typeof configuredBaseUrl === "string" ? configuredBaseUrl : undefined,
  );
  const verification = await new HydraDbClient({ apiKey, baseUrl }).listDatabases();
  if (!verification.ok) {
    await audit({
      workspaceId,
      actorId,
      operation: "hydradb.configure",
      outcome: "failure",
      riskClass: "write",
      metadata: { via: "connect_all", status: verification.status, requestId: verification.requestId },
    });
    throw new Response(
      verification.error ?? "HydraDB did not accept the credential.",
      { status: verification.status >= 400 && verification.status < 500 ? verification.status : 502 },
    );
  }

  const fingerprint = await secretFingerprint(apiKey);
  const accountId = createId("hydra");
  await requireDb()
    .prepare(
      `INSERT INTO hydradb_accounts
       (id, workspace_id, base_url, encrypted_api_key, key_fingerprint, verified_at, status)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'verified')
       ON CONFLICT(workspace_id) DO UPDATE SET
         base_url = excluded.base_url,
         encrypted_api_key = excluded.encrypted_api_key,
         key_fingerprint = excluded.key_fingerprint,
         verified_at = CURRENT_TIMESTAMP,
         status = 'verified',
         updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(accountId, workspaceId, baseUrl, await encryptSecret(apiKey), fingerprint)
    .run();
  await audit({
    workspaceId,
    actorId,
    operation: "hydradb.configure",
    targetType: "hydradb_account",
    targetId: accountId,
    outcome: "success",
    riskClass: "write",
    metadata: { via: "connect_all", fingerprint, requestId: verification.requestId },
  });
  return {
    source: suppliedKey && suppliedKey.length >= 12 ? "supplied_key" : "deployment_shared_key",
    fingerprint,
    baseUrl,
  };
}

/** Adopt every connector reference the attached key can already read. */
async function adoptConnectors(workspaceId: string, actorId: string) {
  const client = await hydraClientForWorkspace(workspaceId);
  const response = await client.listConnectors();
  if (!response.ok) {
    throw new Response(response.error ?? "HydraDB connector discovery failed.", {
      status: response.status >= 400 ? response.status : 502,
    });
  }
  const accessible = accessibleHydraConnectors(response.data).slice(0, MAX_ADOPTED_CONNECTORS);
  if (accessible.length === 0) return { accessible, adoptedIds: new Map<string, string>() };

  const db = requireDb();
  await db.batch(accessible.map((connector) => db.prepare(
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

  const rows = await db
    .prepare(
      `SELECT id, hydradb_connector_id AS hydradbConnectorId
       FROM connectors WHERE workspace_id = ? AND state != 'deleted'`,
    )
    .bind(workspaceId)
    .all<{ id: string; hydradbConnectorId: string }>();
  await audit({
    workspaceId,
    actorId,
    operation: "hydradb.connectors.import_existing",
    outcome: "success",
    riskClass: "write",
    metadata: {
      via: "connect_all",
      accessibleCount: accessible.length,
      providers: [...new Set(accessible.map((item) => item.provider))],
      requestId: response.requestId,
    },
  });
  return {
    accessible,
    adoptedIds: new Map(rows.results.map((row) => [row.hydradbConnectorId, row.id])),
  };
}

/**
 * Discover, configure at full scope, and queue the initial sync for one connector.
 * Failures are captured per connector so a single unreachable source cannot abort
 * onboarding for the rest.
 */
async function runConnectorPipeline(
  workspaceId: string,
  actorId: string,
  connectorRowId: string,
  connector: AccessibleHydraConnector,
  lookbackDays: number,
): Promise<ConnectorOutcome> {
  const outcome: ConnectorOutcome = {
    id: connectorRowId,
    hydradbConnectorId: connector.hydradbConnectorId,
    provider: connector.provider,
    name: connector.name,
    adopted: true,
    resourcesDiscovered: 0,
    resourcesConfigured: 0,
    syncQueued: false,
    state: "connector_created",
    error: null,
  };
  const db = requireDb();
  const client = await hydraClientForWorkspace(workspaceId);

  try {
    const discovery = await client.discoverResources(connector.hydradbConnectorId);
    if (!discovery.ok || !discovery.data) {
      outcome.error = discovery.error ?? "Resource discovery failed.";
      return outcome;
    }
    const resources = genericProviderAdapter.formatResources(discovery.data);
    outcome.resourcesDiscovered = resources.length;
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
        .bind(
          createId("resource"),
          workspaceId,
          connectorRowId,
          resource.id,
          resource.resourceType,
          resource.name,
        )
        .run();
    }
    await db
      .prepare(`UPDATE connectors SET state = 'resources_discovered', updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(connectorRowId)
      .run();
    outcome.state = "resources_discovered";
    await audit({
      workspaceId,
      actorId,
      operation: "connector.discover",
      targetType: "connector",
      targetId: connectorRowId,
      outcome: "success",
      riskClass: "write",
      metadata: { via: "connect_all", resourceCount: resources.length, requestId: discovery.requestId },
    });

    if (resources.length === 0) {
      outcome.error = "HydraDB reported no readable resources for this connector.";
      return outcome;
    }

    const configureResponse = await client.configureConnector(
      connector.hydradbConnectorId,
      resources.map((resource) => ({
        resource_id: resource.id,
        resource_type: resource.resourceType,
        name: resource.name,
      })),
      lookbackDays,
    );
    if (!configureResponse.ok) {
      outcome.error = configureResponse.error ?? "Resource configuration failed.";
      return outcome;
    }
    await db.batch([
      db
        .prepare(
          `UPDATE connector_resources SET selected = 1, status = 'configured', updated_at = CURRENT_TIMESTAMP
           WHERE connector_id = ?`,
        )
        .bind(connectorRowId),
      db
        .prepare(
          `UPDATE connectors SET state = 'initial_sync_requested', last_error = NULL, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
        )
        .bind(connectorRowId),
    ]);
    outcome.resourcesConfigured = resources.length;
    outcome.state = "initial_sync_requested";
    await audit({
      workspaceId,
      actorId,
      operation: "connector.configure",
      targetType: "connector",
      targetId: connectorRowId,
      outcome: "success",
      riskClass: "write",
      metadata: { via: "connect_all", resourceCount: resources.length, requestId: configureResponse.requestId },
    });

    const syncResponse = await client.syncConnector(connector.hydradbConnectorId);
    outcome.syncQueued = syncResponse.ok;
    if (!syncResponse.ok) {
      outcome.error = syncResponse.error ?? "Initial sync could not be queued.";
      return outcome;
    }
    await audit({
      workspaceId,
      actorId,
      operation: "connector.sync",
      targetType: "connector",
      targetId: connectorRowId,
      outcome: "success",
      riskClass: "write",
      metadata: { via: "connect_all", requestId: syncResponse.requestId },
    });
    return outcome;
  } catch (error) {
    outcome.error = error instanceof Error ? error.message : "Connector setup failed.";
    return outcome;
  }
}

/** Bounded fan-out so a large account cannot open fifty simultaneous HydraDB calls. */
async function runPipelines(
  tasks: readonly (() => Promise<ConnectorOutcome>)[],
): Promise<ConnectorOutcome[]> {
  const results: ConnectorOutcome[] = [];
  for (let index = 0; index < tasks.length; index += PIPELINE_CONCURRENCY) {
    const slice = tasks.slice(index, index + PIPELINE_CONCURRENCY);
    results.push(...(await Promise.all(slice.map((task) => task()))));
  }
  return results;
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    if (!runtimeEnv().DB) {
      return noStoreJson(
        { ok: false, error: "Durable workspace storage is not configured on this deployment." },
        { status: 503 },
      );
    }
    const actor = await requireRequestActor();
    requirePrivateControlActor(actor, "One-click workspace connection");
    const payload = await readJson<{ hydradbApiKey?: string; lookbackDays?: number }>(request);
    const suppliedKey = payload.hydradbApiKey?.trim() || null;
    const lookbackDays = Math.max(1, Math.min(365, Math.trunc(payload.lookbackDays ?? 90)));

    const workspace = await ensureWorkspace(actor.id, actor.email, actor.displayName);
    const attachment = await ensureHydraAttachment(workspace.id, actor.id, suppliedKey);
    if (!attachment) {
      return noStoreJson(
        {
          ok: false,
          workspace,
          needs: ["hydradb_api_key"],
          error:
            "This deployment has no shared HydraDB credential, so the workspace needs its own key once.",
        },
        { status: 428 },
      );
    }

    const { accessible, adoptedIds } = await adoptConnectors(workspace.id, actor.id);
    const outcomes = await runPipelines(
      accessible.map((connector) => async () => {
        const rowId = adoptedIds.get(connector.hydradbConnectorId);
        if (!rowId) {
          return {
            id: null,
            hydradbConnectorId: connector.hydradbConnectorId,
            provider: connector.provider,
            name: connector.name,
            adopted: false,
            resourcesDiscovered: 0,
            resourcesConfigured: 0,
            syncQueued: false,
            state: "not_adopted",
            error: "Connector reference could not be adopted into this workspace.",
          } satisfies ConnectorOutcome;
        }
        return runConnectorPipeline(workspace.id, actor.id, rowId, connector, lookbackDays);
      }),
    );

    const summary = {
      accessible: accessible.length,
      adopted: outcomes.filter((item) => item.adopted).length,
      configured: outcomes.filter((item) => item.resourcesConfigured > 0).length,
      syncQueued: outcomes.filter((item) => item.syncQueued).length,
      failed: outcomes.filter((item) => item.error !== null).length,
      resources: outcomes.reduce((total, item) => total + item.resourcesConfigured, 0),
      elapsedMs: Date.now() - startedAt,
    };
    await audit({
      workspaceId: workspace.id,
      actorId: actor.id,
      operation: "workspace.connect_all",
      targetType: "workspace",
      targetId: workspace.id,
      outcome: summary.failed === outcomes.length && outcomes.length > 0 ? "failure" : "success",
      riskClass: "write",
      metadata: { ...summary, hydradbSource: attachment.source, lookbackDays },
    });

    return noStoreJson({
      ok: true,
      workspace,
      hydradb: {
        attached: true,
        source: attachment.source,
        fingerprint: attachment.fingerprint,
        baseUrl: attachment.baseUrl,
      },
      connectors: outcomes,
      summary,
      nextStep: {
        action: "verify_retrieval",
        note:
          "Sources are syncing. Each connector still has to pass QueueProof's canary check before its evidence can enter an answer.",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
