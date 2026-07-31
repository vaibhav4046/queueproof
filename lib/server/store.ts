import { requireDb } from "./runtime";

let initialised = false;

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, display_name TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'bring_your_own_hydradb',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS workspace_members (
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, user_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'owner',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(workspace_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS hydradb_accounts (
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL UNIQUE,
    base_url TEXT NOT NULL DEFAULT 'https://api.hydradb.com',
    encrypted_api_key TEXT NOT NULL, key_fingerprint TEXT NOT NULL,
    verified_at TEXT, status TEXT NOT NULL DEFAULT 'configured',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS connector_providers (
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, provider_id TEXT NOT NULL,
    display_name TEXT NOT NULL, support_class TEXT NOT NULL DEFAULT 'experimental',
    contract_json TEXT NOT NULL, contract_hash TEXT NOT NULL,
    available INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(workspace_id, provider_id)
  )`,
  `CREATE TABLE IF NOT EXISTS connectors (
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, hydradb_connector_id TEXT NOT NULL,
    provider TEXT NOT NULL, name TEXT NOT NULL, account_scope TEXT,
    database TEXT NOT NULL, collection TEXT, state TEXT NOT NULL,
    last_successful_sync_at TEXT, last_error TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(workspace_id, hydradb_connector_id)
  )`,
  `CREATE TABLE IF NOT EXISTS connector_resources (
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, connector_id TEXT NOT NULL,
    external_resource_id TEXT NOT NULL, resource_type TEXT NOT NULL,
    display_name TEXT NOT NULL, selected INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'discovered', provider_cursor_hash TEXT,
    last_synced_at TEXT, metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(connector_id, external_resource_id)
  )`,
  `CREATE TABLE IF NOT EXISTS connection_verifications (
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, connector_id TEXT NOT NULL,
    provider TEXT NOT NULL, account_scope TEXT, resource_ids_json TEXT NOT NULL DEFAULT '[]',
    verification_stage TEXT NOT NULL, last_successful_sync TEXT, cursor_evidence_hash TEXT,
    canary_query_hash TEXT, canary_result_count INTEGER NOT NULL DEFAULT 0,
    source_ids_json TEXT NOT NULL DEFAULT '[]', provider_coverage_json TEXT NOT NULL DEFAULT '[]',
    verified_at TEXT, failure_reason TEXT, api_contract_version TEXT NOT NULL DEFAULT '2',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS query_runs (
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, actor_id TEXT NOT NULL,
    category TEXT NOT NULL, sanitised_query TEXT NOT NULL, mode TEXT NOT NULL,
    plan_json TEXT NOT NULL, provider_coverage_json TEXT NOT NULL DEFAULT '[]',
    source_count INTEGER NOT NULL DEFAULT 0, call_count INTEGER NOT NULL DEFAULT 0,
    latency_ms INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL, error_type TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY, workspace_id TEXT, actor_id TEXT NOT NULL,
    operation TEXT NOT NULL, operation_id TEXT NOT NULL, target_type TEXT,
    target_id TEXT, outcome TEXT NOT NULL, risk_class TEXT NOT NULL DEFAULT 'read',
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
];

export async function ensureCoreSchema(): Promise<void> {
  if (initialised) return;
  const db = requireDb();
  await db.batch(schemaStatements.map((statement) => db.prepare(statement)));
  initialised = true;
}

export const createId = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

export async function audit(input: {
  workspaceId?: string | null;
  actorId: string;
  operation: string;
  operationId?: string;
  targetType?: string;
  targetId?: string;
  outcome: "success" | "failure" | "denied";
  riskClass?: "read" | "write" | "high";
  metadata?: Record<string, unknown>;
}) {
  await ensureCoreSchema();
  const db = requireDb();
  await db
    .prepare(
      `INSERT INTO audit_events
       (id, workspace_id, actor_id, operation, operation_id, target_type, target_id, outcome, risk_class, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      createId("audit"),
      input.workspaceId ?? null,
      input.actorId,
      input.operation,
      input.operationId ?? crypto.randomUUID(),
      input.targetType ?? null,
      input.targetId ?? null,
      input.outcome,
      input.riskClass ?? "read",
      JSON.stringify(input.metadata ?? {}),
    )
    .run();
}

export async function workspaceForUser(userId: string) {
  await ensureCoreSchema();
  const db = requireDb();
  return db
    .prepare(
      `SELECT w.* FROM workspaces w
       JOIN workspace_members wm ON wm.workspace_id = w.id
       WHERE wm.user_id = ? ORDER BY w.created_at ASC LIMIT 1`,
    )
    .bind(userId)
    .first<Record<string, unknown>>();
}

export async function requireWorkspaceForUser(userId: string) {
  const workspace = await workspaceForUser(userId);
  if (!workspace) throw new Response("Create a QueueProof workspace first.", { status: 409 });
  return workspace;
}

