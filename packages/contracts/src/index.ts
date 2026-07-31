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
