import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
};

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  ...timestamps,
});

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  mode: text("mode").notNull().default("bring_your_own_hydradb"),
  ...timestamps,
});

export const workspaceMembers = sqliteTable(
  "workspace_members",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    userId: text("user_id").notNull(),
    role: text("role").notNull().default("owner"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("workspace_members_workspace_user_uq").on(table.workspaceId, table.userId),
    index("workspace_members_user_idx").on(table.userId),
  ],
);

export const hydradbAccounts = sqliteTable(
  "hydradb_accounts",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    baseUrl: text("base_url").notNull().default("https://api.hydradb.com"),
    encryptedApiKey: text("encrypted_api_key").notNull(),
    keyFingerprint: text("key_fingerprint").notNull(),
    verifiedAt: text("verified_at"),
    status: text("status").notNull().default("configured"),
    ...timestamps,
  },
  (table) => [uniqueIndex("hydradb_accounts_workspace_uq").on(table.workspaceId)],
);

export const connectorProviders = sqliteTable(
  "connector_providers",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    providerId: text("provider_id").notNull(),
    displayName: text("display_name").notNull(),
    supportClass: text("support_class").notNull().default("experimental"),
    contractJson: text("contract_json").notNull(),
    contractHash: text("contract_hash").notNull(),
    available: integer("available", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("connector_providers_workspace_provider_uq").on(table.workspaceId, table.providerId),
  ],
);

export const connectorContractVersions = sqliteTable(
  "connector_contract_versions",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    providerId: text("provider_id").notNull(),
    contractHash: text("contract_hash").notNull(),
    contractJson: text("contract_json").notNull(),
    apiVersion: text("api_version").notNull().default("2"),
    capturedAt: text("captured_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("contract_versions_lookup_idx").on(table.workspaceId, table.providerId)],
);

export const connectors = sqliteTable(
  "connectors",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    hydradbConnectorId: text("hydradb_connector_id").notNull(),
    provider: text("provider").notNull(),
    name: text("name").notNull(),
    accountScope: text("account_scope"),
    database: text("database").notNull(),
    collection: text("collection"),
    state: text("state").notNull().default("connector_created"),
    lastSuccessfulSyncAt: text("last_successful_sync_at"),
    lastError: text("last_error"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("connectors_workspace_hydra_uq").on(table.workspaceId, table.hydradbConnectorId),
    index("connectors_workspace_state_idx").on(table.workspaceId, table.state),
  ],
);

export const connectorResources = sqliteTable(
  "connector_resources",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    connectorId: text("connector_id").notNull(),
    externalResourceId: text("external_resource_id").notNull(),
    resourceType: text("resource_type").notNull(),
    displayName: text("display_name").notNull(),
    selected: integer("selected", { mode: "boolean" }).notNull().default(false),
    status: text("status").notNull().default("discovered"),
    providerCursorHash: text("provider_cursor_hash"),
    lastSyncedAt: text("last_synced_at"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("connector_resources_connector_external_uq").on(
      table.connectorId,
      table.externalResourceId,
    ),
  ],
);

export const connectorSyncRuns = sqliteTable(
  "connector_sync_runs",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    connectorId: text("connector_id").notNull(),
    hydradbRunId: text("hydradb_run_id"),
    status: text("status").notNull(),
    requestedAt: text("requested_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    completedAt: text("completed_at"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
  },
  (table) => [index("connector_sync_runs_lookup_idx").on(table.workspaceId, table.connectorId)],
);

export const connectionVerifications = sqliteTable(
  "connection_verifications",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    connectorId: text("connector_id").notNull(),
    provider: text("provider").notNull(),
    accountScope: text("account_scope"),
    resourceIdsJson: text("resource_ids_json").notNull().default("[]"),
    verificationStage: text("verification_stage").notNull(),
    lastSuccessfulSync: text("last_successful_sync"),
    cursorEvidenceHash: text("cursor_evidence_hash"),
    canaryQueryHash: text("canary_query_hash"),
    canaryResultCount: integer("canary_result_count").notNull().default(0),
    sourceIdsJson: text("source_ids_json").notNull().default("[]"),
    providerCoverageJson: text("provider_coverage_json").notNull().default("[]"),
    verifiedAt: text("verified_at"),
    failureReason: text("failure_reason"),
    apiContractVersion: text("api_contract_version").notNull().default("2"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("connection_verifications_latest_idx").on(table.connectorId, table.createdAt)],
);

export const sourceReferences = sqliteTable(
  "source_references",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    provider: text("provider").notNull(),
    connectorId: text("connector_id"),
    externalId: text("external_id"),
    title: text("title").notNull(),
    excerpt: text("excerpt").notNull(),
    sourceUrl: text("source_url"),
    sourceTimestamp: text("source_timestamp"),
    ingestionTimestamp: text("ingestion_timestamp"),
    authority: text("authority").notNull().default("secondary"),
    contentHash: text("content_hash").notNull(),
    metadataJson: text("metadata_json").notNull().default("{}"),
    ...timestamps,
  },
  (table) => [
    index("source_references_workspace_provider_idx").on(table.workspaceId, table.provider),
    uniqueIndex("source_references_workspace_source_uq").on(table.workspaceId, table.id),
  ],
);

export const canonicalEntities = sqliteTable("canonical_entities", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  entityType: text("entity_type").notNull(),
  canonicalName: text("canonical_name").notNull(),
  confidence: integer("confidence").notNull().default(0),
  ...timestamps,
});

export const entityAliases = sqliteTable("entity_aliases", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  entityId: text("entity_id").notNull(),
  alias: text("alias").notNull(),
  sourceId: text("source_id"),
  confidence: integer("confidence").notNull().default(0),
  ...timestamps,
});

export const entityLinks = sqliteTable("entity_links", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  sourceEntityId: text("source_entity_id").notNull(),
  targetEntityId: text("target_entity_id").notNull(),
  predicate: text("predicate").notNull(),
  sourceId: text("source_id"),
  ...timestamps,
});

export const commitments = sqliteTable(
  "commitments",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    sourceId: text("source_id").notNull(),
    kind: text("kind").notNull(),
    extractedText: text("extracted_text").notNull(),
    owner: text("owner"),
    deadline: text("deadline"),
    trackedObjectId: text("tracked_object_id"),
    confidence: integer("confidence").notNull(),
    status: text("status").notNull().default("open"),
    ...timestamps,
  },
  (table) => [index("commitments_workspace_status_idx").on(table.workspaceId, table.status)],
);

export const taskCandidates = sqliteTable(
  "task_candidates",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    title: text("title").notNull(),
    recommendedAction: text("recommended_action").notNull(),
    owner: text("owner"),
    project: text("project"),
    customer: text("customer"),
    deadline: text("deadline"),
    status: text("status").notNull().default("open"),
    attributesJson: text("attributes_json").notNull(),
    confidence: integer("confidence").notNull(),
    ...timestamps,
  },
  (table) => [index("task_candidates_workspace_status_idx").on(table.workspaceId, table.status)],
);

export const taskEvidence = sqliteTable("task_evidence", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  taskId: text("task_id").notNull(),
  sourceId: text("source_id").notNull(),
  relation: text("relation").notNull().default("supports"),
  claim: text("claim").notNull(),
  ...timestamps,
});

export const taskDependencies = sqliteTable("task_dependencies", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  taskId: text("task_id").notNull(),
  dependsOnTaskId: text("depends_on_task_id").notNull(),
  status: text("status").notNull(),
  ...timestamps,
});

export const conflicts = sqliteTable("conflicts", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  conflictType: text("conflict_type").notNull(),
  sourceIdsJson: text("source_ids_json").notNull(),
  proposedResolution: text("proposed_resolution"),
  confidence: integer("confidence").notNull(),
  requiresHuman: integer("requires_human", { mode: "boolean" }).notNull().default(true),
  status: text("status").notNull().default("open"),
  ...timestamps,
});

export const rankingPolicies = sqliteTable("ranking_policies", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  version: text("version").notNull(),
  weightsJson: text("weights_json").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(false),
  createdBy: text("created_by").notNull(),
  ...timestamps,
});

export const rankingRuns = sqliteTable("ranking_runs", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  policyVersion: text("policy_version").notNull(),
  inputHash: text("input_hash").notNull(),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
  ...timestamps,
});

export const rankingItems = sqliteTable("ranking_items", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  rankingRunId: text("ranking_run_id").notNull(),
  taskId: text("task_id").notNull(),
  rank: integer("rank").notNull(),
  componentScoresJson: text("component_scores_json").notNull(),
  penaltiesJson: text("penalties_json").notNull(),
  finalScore: integer("final_score").notNull(),
  confidence: integer("confidence").notNull(),
  explanationJson: text("explanation_json").notNull(),
  sensitivityJson: text("sensitivity_json").notNull(),
  ...timestamps,
});

export const queueSnapshots = sqliteTable("queue_snapshots", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  rankingRunId: text("ranking_run_id").notNull(),
  itemIdsJson: text("item_ids_json").notNull(),
  reason: text("reason").notNull(),
  ...timestamps,
});

export const queryRuns = sqliteTable(
  "query_runs",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    actorId: text("actor_id").notNull(),
    category: text("category").notNull(),
    sanitisedQuery: text("sanitised_query").notNull(),
    mode: text("mode").notNull(),
    planJson: text("plan_json").notNull(),
    providerCoverageJson: text("provider_coverage_json").notNull().default("[]"),
    sourceCount: integer("source_count").notNull().default(0),
    callCount: integer("call_count").notNull().default(0),
    latencyMs: integer("latency_ms").notNull().default(0),
    status: text("status").notNull(),
    errorType: text("error_type"),
    ...timestamps,
  },
  (table) => [index("query_runs_workspace_created_idx").on(table.workspaceId, table.createdAt)],
);

export const querySteps = sqliteTable("query_steps", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  queryRunId: text("query_run_id").notNull(),
  sequence: integer("sequence").notNull(),
  operation: text("operation").notNull(),
  mode: text("mode").notNull(),
  filtersJson: text("filters_json").notNull().default("{}"),
  resultCount: integer("result_count").notNull().default(0),
  latencyMs: integer("latency_ms").notNull().default(0),
  status: text("status").notNull(),
  ...timestamps,
});

export const retrievalSources = sqliteTable("retrieval_sources", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  queryRunId: text("query_run_id").notNull(),
  sourceId: text("source_id").notNull(),
  rank: integer("rank").notNull(),
  score: integer("score").notNull(),
  selected: integer("selected", { mode: "boolean" }).notNull().default(false),
  ...timestamps,
});

export const executionPackets = sqliteTable("execution_packets", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  taskId: text("task_id").notNull(),
  policyVersion: text("policy_version").notNull(),
  packetJson: text("packet_json").notNull(),
  status: text("status").notNull().default("available"),
  ...timestamps,
});

export const executionPacketLeases = sqliteTable("execution_packet_leases", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  packetId: text("packet_id").notNull(),
  agentId: text("agent_id").notNull(),
  leaseTokenHash: text("lease_token_hash").notNull(),
  expiresAt: text("expires_at").notNull(),
  releasedAt: text("released_at"),
  ...timestamps,
});

export const executionEvents = sqliteTable("execution_events", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  packetId: text("packet_id").notNull(),
  eventType: text("event_type").notNull(),
  payloadJson: text("payload_json").notNull(),
  actorId: text("actor_id").notNull(),
  ...timestamps,
});

export const actionProposals = sqliteTable(
  "action_proposals",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    provider: text("provider").notNull(),
    actionType: text("action_type").notNull(),
    payloadJson: text("payload_json").notNull(),
    evidenceIdsJson: text("evidence_ids_json").notNull().default("[]"),
    riskClass: text("risk_class").notNull().default("low"),
    idempotencyKey: text("idempotency_key").notNull(),
    status: text("status").notNull().default("proposed"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("action_proposals_workspace_idempotency_uq").on(
      table.workspaceId,
      table.idempotencyKey,
    ),
  ],
);

export const actionApprovals = sqliteTable(
  "action_approvals",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    proposalId: text("proposal_id").notNull(),
    decision: text("decision").notNull(),
    decidedBy: text("decided_by").notNull(),
    decidedAt: text("decided_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("action_approvals_proposal_uq").on(table.proposalId)],
);

export const actionExecutions = sqliteTable(
  "action_executions",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    proposalId: text("proposal_id").notNull(),
    status: text("status").notNull().default("pending"),
    providerResponseId: text("provider_response_id"),
    error: text("error"),
    ...timestamps,
  },
  (table) => [uniqueIndex("action_executions_proposal_uq").on(table.proposalId)],
);

export const memories = sqliteTable("memories", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  memoryClass: text("memory_class").notNull(),
  title: text("title").notNull(),
  valueJson: text("value_json").notNull(),
  provenanceJson: text("provenance_json").notNull(),
  consentStatus: text("consent_status").notNull(),
  retentionUntil: text("retention_until"),
  status: text("status").notNull().default("active"),
  ...timestamps,
});

export const memoryVersions = sqliteTable("memory_versions", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  memoryId: text("memory_id").notNull(),
  version: integer("version").notNull(),
  valueJson: text("value_json").notNull(),
  changedBy: text("changed_by").notNull(),
  changeReason: text("change_reason").notNull(),
  ...timestamps,
});

export const skills = sqliteTable("skills", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  activeVersion: integer("active_version").notNull().default(1),
  ...timestamps,
});

export const skillVersions = sqliteTable("skill_versions", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  skillId: text("skill_id").notNull(),
  version: integer("version").notNull(),
  manifestHash: text("manifest_hash").notNull(),
  content: text("content").notNull(),
  testsJson: text("tests_json").notNull(),
  ...timestamps,
});

export const skillProposals = sqliteTable("skill_proposals", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  skillId: text("skill_id"),
  diff: text("diff").notNull(),
  evidenceJson: text("evidence_json").notNull(),
  testResultJson: text("test_result_json").notNull(),
  status: text("status").notNull().default("pending"),
  ...timestamps,
});

export const mcpClients = sqliteTable("mcp_clients", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  clientType: text("client_type").notNull(),
  clientVersion: text("client_version"),
  scopesJson: text("scopes_json").notNull(),
  lastHandshakeAt: text("last_handshake_at"),
  lastToolCallAt: text("last_tool_call_at"),
  status: text("status").notNull().default("configured"),
  ...timestamps,
});

export const mcpTokens = sqliteTable("mcp_tokens", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  clientId: text("client_id").notNull(),
  tokenHash: text("token_hash").notNull(),
  audience: text("audience").notNull(),
  scopesJson: text("scopes_json").notNull(),
  expiresAt: text("expires_at").notNull(),
  revokedAt: text("revoked_at"),
  ...timestamps,
});

export const evalSuites = sqliteTable("eval_suites", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  name: text("name").notNull(),
  mode: text("mode").notNull(),
  ...timestamps,
});

export const evalCases = sqliteTable("eval_cases", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  suiteId: text("suite_id").notNull(),
  question: text("question").notNull(),
  expectedJson: text("expected_json").notNull(),
  fixtureOnly: integer("fixture_only", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
});

export const evalRuns = sqliteTable("eval_runs", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  suiteId: text("suite_id").notNull(),
  mode: text("mode").notNull(),
  status: text("status").notNull(),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
  ...timestamps,
});

export const evalResults = sqliteTable("eval_results", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  runId: text("run_id").notNull(),
  caseId: text("case_id").notNull(),
  metricsJson: text("metrics_json").notNull(),
  traceJson: text("trace_json").notNull(),
  status: text("status").notNull(),
  ...timestamps,
});

export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id"),
    actorId: text("actor_id").notNull(),
    operation: text("operation").notNull(),
    operationId: text("operation_id").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    outcome: text("outcome").notNull(),
    riskClass: text("risk_class").notNull().default("read"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("audit_events_workspace_created_idx").on(table.workspaceId, table.createdAt)],
);
