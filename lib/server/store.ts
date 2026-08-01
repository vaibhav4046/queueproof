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
  `CREATE TABLE IF NOT EXISTS source_references (
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, provider TEXT NOT NULL,
    connector_id TEXT, external_id TEXT, title TEXT NOT NULL, excerpt TEXT NOT NULL,
    source_url TEXT, source_timestamp TEXT, ingestion_timestamp TEXT,
    authority TEXT NOT NULL DEFAULT 'secondary', content_hash TEXT NOT NULL,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS task_candidates (
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, title TEXT NOT NULL,
    recommended_action TEXT NOT NULL, owner TEXT, project TEXT, customer TEXT,
    deadline TEXT, status TEXT NOT NULL DEFAULT 'open', attributes_json TEXT NOT NULL,
    confidence INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS task_evidence (
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, task_id TEXT NOT NULL,
    source_id TEXT NOT NULL, relation TEXT NOT NULL DEFAULT 'supports', claim TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS ranking_runs (
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, policy_version TEXT NOT NULL,
    input_hash TEXT NOT NULL, started_at TEXT NOT NULL, completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS ranking_items (
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, ranking_run_id TEXT NOT NULL,
    task_id TEXT NOT NULL, rank INTEGER NOT NULL, component_scores_json TEXT NOT NULL,
    penalties_json TEXT NOT NULL, final_score INTEGER NOT NULL, confidence INTEGER NOT NULL,
    explanation_json TEXT NOT NULL, sensitivity_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS queue_snapshots (
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, ranking_run_id TEXT NOT NULL,
    item_ids_json TEXT NOT NULL, reason TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS execution_packets (
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, task_id TEXT NOT NULL,
    policy_version TEXT NOT NULL, packet_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'available',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS execution_events (
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, packet_id TEXT NOT NULL,
    event_type TEXT NOT NULL, payload_json TEXT NOT NULL, actor_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS mcp_tokens (
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, client_id TEXT NOT NULL,
    token_hash TEXT NOT NULL, audience TEXT NOT NULL, scopes_json TEXT NOT NULL,
    expires_at TEXT NOT NULL, revoked_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS mcp_clients (
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, client_type TEXT NOT NULL,
    client_version TEXT, scopes_json TEXT NOT NULL, last_handshake_at TEXT,
    last_tool_call_at TEXT, status TEXT NOT NULL DEFAULT 'configured',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  // Document intake. UNIQUE(workspace_id, content_hash) is what makes duplicate
  // detection real: a check-then-insert would race, whereas the constraint cannot be
  // beaten by two concurrent uploads of the same file.
  `CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, filename TEXT NOT NULL,
    mime TEXT NOT NULL, byte_size INTEGER NOT NULL, content_hash TEXT NOT NULL,
    -- The database a document was ingested into must travel with the row. Deriving it
    -- later from the workspace slug queries the wrong database and every status poll
    -- fails, which is exactly what happened before this column existed.
    hydradb_database TEXT,
    hydradb_source_id TEXT, stage TEXT NOT NULL DEFAULT 'received', error TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(workspace_id, content_hash)
  )`,
  `CREATE TABLE IF NOT EXISTS document_ingestion_runs (
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, document_id TEXT NOT NULL,
    stage TEXT NOT NULL, detail TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  // Action proposal tables. queueproof_propose_action and queueproof_get_action_status
  // read and write these, but ensureCoreSchema() never created them, so both tools threw
  // "no such table" at runtime — undetected because no test invokes an MCP handler.
  // The UNIQUE constraint on idempotency_key is what makes a repeated proposal a no-op
  // rather than a duplicate.
  `CREATE TABLE IF NOT EXISTS action_proposals (
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, provider TEXT NOT NULL,
    action_type TEXT NOT NULL, payload_json TEXT NOT NULL,
    evidence_ids_json TEXT NOT NULL DEFAULT '[]', risk_class TEXT NOT NULL DEFAULT 'low',
    idempotency_key TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'proposed',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(workspace_id, idempotency_key)
  )`,
  `CREATE TABLE IF NOT EXISTS action_approvals (
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, proposal_id TEXT NOT NULL,
    decision TEXT NOT NULL, decided_by TEXT, decided_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(proposal_id)
  )`,
  `CREATE TABLE IF NOT EXISTS action_executions (
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, proposal_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', provider_response_id TEXT, error TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(proposal_id)
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
