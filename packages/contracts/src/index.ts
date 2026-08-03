import { z } from "zod";

export const connectorStateSchema = z.enum([
  "not_configured",
  "credentials_submitted",
  "connector_created",
  "resources_discovered",
  "resources_selected",
  "initial_sync_requested",
  "sync_in_progress",
  "data_verified",
  "degraded",
  "authentication_expired",
  "permission_insufficient",
  "rate_limited",
  "failed",
  "deleted",
]);

export type ConnectorState = z.infer<typeof connectorStateSchema>;

export const sourceReferenceSchema = z.object({
  sourceId: z.string().min(1),
  provider: z.string().min(1),
  externalId: z.string().nullable().default(null),
  title: z.string().default("Untitled source"),
  excerpt: z.string(),
  timestamp: z.string().datetime().nullable().default(null),
  ingestionTimestamp: z.string().datetime().nullable().default(null),
  url: z.string().url().nullable().default(null),
  authority: z.enum(["primary", "secondary", "inferred"]).default("secondary"),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type SourceReference = z.infer<typeof sourceReferenceSchema>;

export const rankingInputSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(["open", "blocked", "completed", "cancelled", "unknown"]),
  businessImpact: z.number().min(0).max(20),
  urgency: z.number().min(0).max(18),
  dependencyUnlock: z.number().min(0).max(16),
  customerRevenue: z.number().min(0).max(12),
  incidentSecurity: z.number().min(0).max(10),
  commitmentStrength: z.number().min(0).max(8),
  authorityReliability: z.number().min(0).max(6),
  evidenceFreshness: z.number().min(0).max(4),
  quickWinLeverage: z.number().min(0).max(6),
  penalties: z.object({
    likelyResolved: z.number().min(0).max(40).default(0),
    duplicate: z.number().min(0).max(30).default(0),
    unresolvedDependency: z.number().min(0).max(18).default(0),
    weakEvidence: z.number().min(0).max(12).default(0),
    conflictingEvidence: z.number().min(0).max(10).default(0),
    staleEvidence: z.number().min(0).max(12).default(0),
    missingOwner: z.number().min(0).max(8).default(0),
    lowActionability: z.number().min(0).max(8).default(0),
  }),
  confidence: z.number().min(0).max(1),
  evidence: z.array(sourceReferenceSchema).min(1),
});

export type RankingInput = z.infer<typeof rankingInputSchema>;

export const executionPacketSchema = z.object({
  packet_id: z.string(),
  workspace_id: z.string(),
  created_at: z.string().datetime(),
  policy_version: z.string(),
  task: z.object({
    title: z.string(),
    objective: z.string(),
    owner: z.string().nullable(),
    project: z.string().nullable(),
    deadline: z.string().datetime().nullable(),
    priority_score: z.number().min(0).max(100),
    confidence: z.number().min(0).max(1),
  }),
  why_now: z.array(z.string()),
  constraints: z.array(z.string()),
  dependencies: z.array(z.string()),
  acceptance_criteria: z.array(z.string()),
  evidence: z.array(sourceReferenceSchema).min(1),
  contradictions: z.array(z.unknown()),
  missing_information: z.array(z.string()),
  score_breakdown: z.record(z.string(), z.number()).default({}),
  penalties: z.record(z.string(), z.number()).default({}),
  active_formula: z.string().default(""),
  recommended_safe_action: z.string().default("Review the cited evidence before taking action."),
  provider_coverage: z.array(z.string()).default([]),
  deduplicated_tasks: z.array(z.string()).default([]),
  status: z.string().default("open"),
  recommended_agent: z.enum(["human", "codex", "claude", "kimi", "kilo", "generic"]),
  permissions: z.object({
    read: z.array(z.string()),
    write: z.array(z.string()),
    approval_required: z.boolean(),
  }),
  completion_callback: z.object({
    type: z.literal("mcp_tool"),
    tool: z.literal("queueproof_report_execution_result"),
  }),
});

export type ExecutionPacket = z.infer<typeof executionPacketSchema>;

export const queryRequestSchema = z.object({
  query: z.string().trim().min(1).max(4_000),
  database: z.string().trim().min(1),
  collections: z.array(z.string()).min(1).max(100).optional(),
  mode: z.enum(["fast", "thinking", "auto"]).default("auto"),
  providerFilters: z.array(z.string()).default([]),
});

export const groundedCitationSchema = z.object({
  id: z.string().min(1),
  provider: z.string().min(1),
  title: z.string().min(1),
  excerpt: z.string(),
  timestamp: z.string().nullable(),
  url: z.string().nullable(),
});

export const groundedClaimSchema = z.object({
  text: z.string().min(1),
  citation_ids: z.array(z.string().min(1)).min(1),
  providers: z.array(z.string().min(1)).min(1),
});

export const groundedPriorityItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  normalized_entity: z.string().min(1),
  owner: z.string().nullable(),
  due_date: z.string().nullable(),
  status: z.string().min(1),
  score: z.number().min(0).max(100),
  score_breakdown: z.record(z.string(), z.number()),
  penalties: z.record(z.string(), z.number()),
  why_now: z.array(z.string()),
  recommended_next_safe_action: z.string().min(1),
  evidence_ids: z.array(z.string().min(1)).min(1),
  disagreements: z.array(z.unknown()),
  confidence: z.number().min(0).max(1),
  provider_coverage: z.array(z.string().min(1)).min(1),
  deduplicated_tasks: z.array(z.string()),
  approval_required: z.boolean(),
});

export const retrievalReceiptSchema = z.object({
  query_id: z.string().min(1),
  hydradb_mode: z.enum(["fast", "thinking"]),
  routing_reason: z.string().min(1),
  hydradb_call_count: z.number().int().min(0),
  total_latency_ms: z.number().int().min(0),
  provider_coverage: z.array(z.string()),
  receipt_count: z.number().int().min(0),
  metadata_filters: z.record(z.string(), z.unknown()),
  graph_usage: z.boolean(),
  estimated_cost_units: z.number().min(0),
  timestamp: z.string().datetime(),
});

export const groundedAnswerContractSchema = z.object({
  answer: z.string().min(1),
  claims: z.array(groundedClaimSchema),
  citations: z.array(groundedCitationSchema),
  priority_items: z.array(groundedPriorityItemSchema),
  contradictions: z.array(z.unknown()),
  missing_information: z.array(z.string()),
  retrieval_receipt: retrievalReceiptSchema,
  routing_reason: z.string().min(1),
});

export const actionProposalSchema = z.object({
  provider: z.string(),
  accountScope: z.string(),
  resourceId: z.string(),
  actionType: z.string(),
  payload: z.record(z.string(), z.unknown()),
  reason: z.string(),
  evidenceIds: z.array(z.string()).min(1),
  riskClass: z.enum(["low", "medium", "high", "critical"]),
  idempotencyKey: z.string().min(16),
});
