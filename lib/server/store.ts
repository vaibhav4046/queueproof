import { requireDb, runtimeEnv } from "./runtime";
import { publicRateLimitBucketId } from "./public-client";

let initialised = false;

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, display_name TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS auth_identities (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
    issuer TEXT NOT NULL, subject TEXT NOT NULL,
    email TEXT, email_verified INTEGER NOT NULL DEFAULT 0,
    display_name TEXT, avatar_url TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(issuer, subject), UNIQUE(user_id)
  )`,
  `CREATE INDEX IF NOT EXISTS auth_identities_email_idx ON auth_identities(email)`,
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
  `CREATE TABLE IF NOT EXISTS query_steps (
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, query_run_id TEXT NOT NULL,
    sequence INTEGER NOT NULL, operation TEXT NOT NULL, mode TEXT NOT NULL,
    filters_json TEXT NOT NULL DEFAULT '{}', result_count INTEGER NOT NULL DEFAULT 0,
    latency_ms INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS query_steps_run_sequence_uq
    ON query_steps(query_run_id, sequence)`,
  `CREATE INDEX IF NOT EXISTS query_steps_workspace_run_idx
    ON query_steps(workspace_id, query_run_id)`,
  `CREATE TABLE IF NOT EXISTS query_receipts (
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, query_run_id TEXT NOT NULL UNIQUE,
    schema_version TEXT NOT NULL DEFAULT 'live-proof-v1', receipt_json TEXT NOT NULL,
    receipt_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS query_receipts_workspace_created_idx
    ON query_receipts(workspace_id, created_at)`,
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
    page_count INTEGER, indexed_at TEXT, processing_duration_ms INTEGER,
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
  // The workspace-scoped UNIQUE constraint on idempotency_key makes a repeated
  // proposal a no-op without coupling otherwise independent workspaces.
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
    decision TEXT NOT NULL, decided_by TEXT NOT NULL, decided_at TEXT NOT NULL,
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
  // Live benchmark evidence is written after an exact production SHA is deployed.
  // Keeping it durable breaks the otherwise unavoidable cycle where committing a
  // measured JSON file changes the very SHA that file claims to measure.
  `CREATE TABLE IF NOT EXISTS benchmark_artifacts (
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, kind TEXT NOT NULL,
    release_sha TEXT NOT NULL, artifact_json TEXT NOT NULL,
    artifact_hash TEXT NOT NULL, generated_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(workspace_id, kind, release_sha)
  )`,
  `CREATE INDEX IF NOT EXISTS benchmark_artifacts_release_idx
    ON benchmark_artifacts(workspace_id, release_sha, kind)`,
  `CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY, workspace_id TEXT, actor_id TEXT NOT NULL,
    operation TEXT NOT NULL, operation_id TEXT NOT NULL, target_type TEXT,
    target_id TEXT, outcome TEXT NOT NULL, risk_class TEXT NOT NULL DEFAULT 'read',
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
];

/**
 * Additive column migrations.
 *
 * CREATE TABLE IF NOT EXISTS is a no-op once a table exists, so adding a column to
 * `schemaStatements` silently does nothing on any database that was created earlier —
 * and the first write referencing that column fails at runtime. Each statement here is
 * run independently and a "duplicate column" error is expected and ignored, which makes
 * the whole set safe to re-run on every boot.
 */
const columnMigrations = [
  `ALTER TABLE documents ADD COLUMN hydradb_database TEXT`,
  `ALTER TABLE documents ADD COLUMN page_count INTEGER`,
  `ALTER TABLE documents ADD COLUMN indexed_at TEXT`,
  `ALTER TABLE documents ADD COLUMN processing_duration_ms INTEGER`,
  `ALTER TABLE mcp_clients ADD COLUMN auth_method TEXT`,
  `ALTER TABLE mcp_clients ADD COLUMN auth_issuer TEXT`,
  `ALTER TABLE mcp_clients ADD COLUMN external_client_id TEXT`,
  `ALTER TABLE mcp_clients ADD COLUMN user_id TEXT`,
];

export async function ensureCoreSchema(): Promise<void> {
  if (initialised) return;
  const db = requireDb();
  await db.batch(schemaStatements.map((statement) => db.prepare(statement)));

  for (const statement of columnMigrations) {
    try {
      await db.prepare(statement).run();
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      // Anything other than "the column is already there" is a real failure.
      if (!message.includes("duplicate column") && !message.includes("already exists")) {
        throw error;
      }
    }
  }

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

/**
 * Durable public-sandbox rate limit backed by the existing audit ledger.
 *
 * The first count avoids adding rows after a bucket is already full. Recording before
 * the second count means concurrent requests cannot all pass from the same stale count:
 * excess contenders see the enlarged bucket and fail closed. Private actors bypass this
 * helper because their signed identity is the accountability boundary.
 */
export async function enforcePublicRateLimit(input: {
  actorId: string;
  workspaceId: string;
  operation: string;
  limit: number;
  windowMs: number;
  /** Optional deployment-wide ceiling. Defaults to ten client buckets. */
  globalLimit?: number;
}) {
  if (input.actorId !== "user:public-access") return;
  await ensureCoreSchema();
  const db = requireDb();
  const auditOperation = `rate_limit.${input.operation}`;
  // A signed random browser nonce is HMACed before it reaches this ledger. No IP,
  // user-agent, email, or raw cookie identifier is stored. If cookies/signing are not
  // available the resolver fails safely into the legacy shared public bucket.
  const bucketActorId = await publicRateLimitBucketId();
  const globalLimit = input.globalLimit ?? Math.max(input.limit * 10, input.limit + 10);
  const cutoff = new Date(Date.now() - input.windowMs).toISOString().slice(0, 19).replace("T", " ");
  const bucketCount = async () => Number((await db
    .prepare(
      `SELECT COUNT(*) AS total FROM audit_events
       WHERE workspace_id = ? AND actor_id = ? AND operation = ? AND created_at >= ?`,
    )
    .bind(input.workspaceId, bucketActorId, auditOperation, cutoff)
    .first<{ total: number }>())?.total ?? 0);
  const overallCount = async () => Number((await db
    .prepare(
      `SELECT COUNT(*) AS total FROM audit_events
       WHERE workspace_id = ? AND operation = ? AND target_type = 'public_rate_limit'
       AND created_at >= ?`,
    )
    .bind(input.workspaceId, auditOperation, cutoff)
    .first<{ total: number }>())?.total ?? 0);
  const retryAfter = Math.max(1, Math.ceil(input.windowMs / 1_000));
  const reject = () => {
    throw new Response(
      `Public sandbox rate limit reached for ${input.operation}. Try again later.`,
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  };
  if (await bucketCount() >= input.limit || await overallCount() >= globalLimit) reject();
  await audit({
    workspaceId: input.workspaceId,
    actorId: bucketActorId,
    operation: auditOperation,
    targetType: "public_rate_limit",
    outcome: "success",
    metadata: { clientLimit: input.limit, globalLimit, windowMs: input.windowMs },
  });
  if (await bucketCount() > input.limit || await overallCount() > globalLimit) reject();
}

export async function workspaceForUser(userId: string) {
  await ensureCoreSchema();
  const db = requireDb();
  // Public access must resolve to one deliberate workspace that is explicitly assigned to
  // the public actor. Never fall back to a singleton: after Auth0 onboarding that one
  // workspace could be a real user's private tenant on a fresh or misconfigured deploy.
  if (userId === "user:public-access") {
    const configuredId = runtimeEnv().QUEUEPROOF_PUBLIC_WORKSPACE_ID?.trim();
    if (!configuredId) return null;
    return db
      .prepare(
        `SELECT w.* FROM workspaces w
         JOIN workspace_members wm ON wm.workspace_id = w.id
         WHERE w.id = ? AND wm.user_id = ? LIMIT 1`,
      )
      .bind(configuredId, userId)
      .first<Record<string, unknown>>();
  }
  const memberships = await db
    .prepare(
      `SELECT w.* FROM workspaces w
       JOIN workspace_members wm ON wm.workspace_id = w.id
       WHERE wm.user_id = ? ORDER BY w.created_at ASC, w.id ASC LIMIT 2`,
    )
    .bind(userId)
    .all<Record<string, unknown>>();
  if (memberships.results.length > 1) {
    throw new Response(
      "This account belongs to multiple workspaces, but no active workspace was selected.",
      { status: 409 },
    );
  }
  return memberships.results[0] ?? null;
}

export async function requireWorkspaceForUser(userId: string) {
  const workspace = await workspaceForUser(userId);
  if (!workspace) throw new Response("Create a QueueProof workspace first.", { status: 409 });
  return workspace;
}

/**
 * Resolve the actor's workspace and require its durable owner role.
 *
 * `requirePrivateControlActor` separates the public demo from authenticated actors,
 * but authentication alone is not authorization: a future collaborator delivered by
 * the trusted identity gateway must not be able to rotate credentials, mint MCP keys,
 * sync connectors, upload documents, or prepare provider writes. Workspace creation
 * deliberately keeps using `requireWorkspaceForUser` because it creates this first
 * owner membership; established control-plane routes use this guard instead.
 */
export async function requireOwnerWorkspaceForUser(userId: string) {
  const workspace = await requireWorkspaceForUser(userId);
  const membership = await requireDb()
    .prepare(`SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ? LIMIT 1`)
    .bind(String(workspace.id), userId)
    .first<{ role: string }>();
  if (membership?.role !== "owner") {
    throw new Response("Only a workspace owner may use this control-plane operation.", { status: 403 });
  }
  return workspace;
}
