import { beforeAll, describe, expect, it } from "vitest";
import { liveProofStateSchema, workflowStageSchema } from "../packages/contracts/src";
import { buildProofGraphView, createQueryWorkflowRecorder } from "../lib/server/query-workflow";
import { requireDb } from "../lib/server/runtime";
import { createId, ensureCoreSchema } from "../lib/server/store";

const providers = [
  { provider: "slack", connectorId: "connector-slack", status: "received" as const,
    receiptCount: 1, latencyMs: 42, evidenceIds: ["ev-slack"] },
  { provider: "gmail", connectorId: "connector-gmail", status: "not-required" as const,
    receiptCount: 0, evidenceIds: [] },
];

const priority = {
  id: "task-1",
  title: "Review the verified fix",
  normalized_entity: "AuthShield",
  owner: null,
  due_date: null,
  status: "open",
  score: 91,
  score_breakdown: { urgency: 25 },
  penalties: {},
  why_now: ["Customer impact is active"],
  recommended_next_safe_action: "Review the cited receipt before proposing a provider write.",
  evidence_ids: ["ev-slack"],
  disagreements: [],
  confidence: 0.9,
  provider_coverage: ["slack"],
  deduplicated_tasks: [],
  approval_required: true,
};

describe("verified query workflow", () => {
  beforeAll(async () => {
    await ensureCoreSchema();
  });

  it("declares every backend stage required by the live proof contract", () => {
    expect(workflowStageSchema.options).toEqual([
      "idle", "routing", "retrieving", "linking", "checking-contradictions", "validating",
      "compiling-action", "awaiting-approval", "executing", "complete", "partial", "abstained", "failed",
    ]);
  });

  it("builds graph edges only from exact evidence identifiers", () => {
    const graph = buildProofGraphView({
      providers,
      evidence: [{ id: "ev-slack", provider: "slack", title: "Escalation thread" }],
      claims: [{ text: "The incident was escalated.", citation_ids: ["ev-slack"], providers: ["slack"] }],
      contradictions: [{ summary: "The promised date changed.", providers: ["slack"], evidenceIds: ["ev-slack"] }],
      priorityItems: [priority],
    });
    expect(graph.nodes.some((node) => node.id === "provider:gmail")).toBe(false);
    expect(graph.edges.map((edge) => edge.type)).toEqual(["returned", "supports", "conflicts", "prioritises"]);
    expect(graph.edges.every((edge) => graph.nodes.some((node) => node.id === edge.source) &&
      graph.nodes.some((node) => node.id === edge.target))).toBe(true);
  });

  it("accepts a persisted, replayable receipt and rejects a decorative kind", () => {
    const workflow = {
      schemaVersion: "live-proof-v1",
      kind: "verified-backend-receipt",
      queryId: "query-12345678",
      stage: "complete",
      mode: "fast",
      routingReason: "Exact identifier query",
      providers,
      graph: buildProofGraphView({
        providers,
        evidence: [{ id: "ev-slack", provider: "slack", title: "Escalation thread" }],
        claims: [{ text: "The incident was escalated.", citation_ids: ["ev-slack"], providers: ["slack"] }],
        contradictions: [],
        priorityItems: [priority],
      }),
      claims: [{ text: "The incident was escalated.", citation_ids: ["ev-slack"], providers: ["slack"] }],
      contradictions: [],
      priorityItems: [priority],
      events: [{ sequence: 1, stage: "complete", recordedAt: "2026-08-04T08:00:00.000Z",
        detail: "Grounded answer finalized.", providers, receiptCount: 1, callCount: 1 }],
      receipt: { query_id: "query-12345678", hydradb_mode: "fast", routing_reason: "Exact identifier query",
        hydradb_call_count: 1, total_latency_ms: 42, provider_coverage: ["slack"], receipt_count: 1,
        metadata_filters: {}, graph_usage: true, estimated_cost_units: 1, timestamp: "2026-08-04T08:00:00.000Z" },
      persisted: true,
      replayAvailable: true,
    } as const;
    expect(liveProofStateSchema.safeParse(workflow).success).toBe(true);
    expect(liveProofStateSchema.safeParse({ ...workflow, kind: "simulated-progress" }).success).toBe(false);
  });

  it("persists the real mode for every Fast-to-Thinking workflow step", async () => {
    const queryId = createId("query_auto_mode");
    const workspaceId = createId("workspace_auto_mode");
    await requireDb().prepare(
      `INSERT INTO query_runs
       (id, workspace_id, actor_id, category, sanitised_query, mode, plan_json,
        provider_coverage_json, source_count, call_count, latency_ms, status, error_type)
       VALUES (?, ?, 'test-actor', 'multi_hop', 'redacted', 'fast', '{}', '[]', 0, 0, 0, 'routing', NULL)`,
    ).bind(queryId, workspaceId).run();

    const recorder = createQueryWorkflowRecorder({
      queryId,
      workspaceId,
      mode: "fast",
      providerSeeds: [{ provider: "slack", required: true }],
    });
    await recorder.record("routing", "Auto starts Fast.", { mode: "fast" });
    await recorder.markQuerying(["slack"], "Fast primary query.", 1, "fast");
    await recorder.markResponse({
      providers: ["slack"], ok: true, latencyMs: 10, callCount: 1, mode: "fast",
      evidenceByProvider: new Map([["slack", ["evidence-fast"]]]),
    });
    await recorder.record("routing", "Fast was partial; escalate.", { callCount: 1, mode: "thinking" });
    await recorder.markQuerying(["slack"], "Thinking follow-up query.", 2, "thinking");
    await recorder.markResponse({
      providers: ["slack"], ok: true, latencyMs: 20, callCount: 2, mode: "thinking",
      evidenceByProvider: new Map([["slack", ["evidence-thinking"]]]),
    });

    const steps = await requireDb().prepare(
      "SELECT sequence, mode FROM query_steps WHERE query_run_id = ? ORDER BY sequence",
    ).bind(queryId).all<{ sequence: number; mode: string }>();
    expect(steps.results.map((step) => step.mode)).toEqual([
      "fast", "fast", "fast", "thinking", "thinking", "thinking",
    ]);
    const run = await requireDb().prepare("SELECT mode, call_count FROM query_runs WHERE id = ?")
      .bind(queryId).first<{ mode: string; call_count: number }>();
    expect(run).toEqual(expect.objectContaining({ mode: "thinking", call_count: 2 }));
  });
});
