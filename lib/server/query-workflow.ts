import type {
  LiveProofState,
  ProofGraphView,
  ProviderActivity,
  WorkflowEvent,
  WorkflowStage,
} from "../../packages/contracts/src";
import { sha256 } from "../../packages/security/src";
import { requireDb } from "./runtime";
import { createId } from "./store";

type EvidenceForGraph = {
  id: string;
  provider: string;
  title: string;
};

type ClaimForGraph = {
  text: string;
  citation_ids: string[];
  providers: string[];
};

type ContradictionForGraph = {
  summary: string;
  providers: string[];
  evidenceIds: string[];
};

type PriorityForGraph = {
  id: string;
  title: string;
  evidence_ids: string[];
};

export function buildProofGraphView(input: {
  providers: ProviderActivity[];
  evidence: EvidenceForGraph[];
  claims: ClaimForGraph[];
  contradictions: ContradictionForGraph[];
  priorityItems: PriorityForGraph[];
}): ProofGraphView {
  const nodes: ProofGraphView["nodes"] = [];
  const edges: ProofGraphView["edges"] = [];
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  const addNode = (node: ProofGraphView["nodes"][number]) => {
    if (nodeIds.has(node.id)) return;
    nodeIds.add(node.id);
    nodes.push(node);
  };
  const addEdge = (edge: ProofGraphView["edges"][number]) => {
    if (edgeIds.has(edge.id) || !nodeIds.has(edge.source) || !nodeIds.has(edge.target)) return;
    edgeIds.add(edge.id);
    edges.push(edge);
  };

  for (const provider of input.providers) {
    if (provider.status === "not-required") continue;
    addNode({
      id: `provider:${provider.provider}`,
      type: "provider",
      label: provider.provider,
      provider: provider.provider,
    });
  }
  for (const evidence of input.evidence) {
    const evidenceNodeId = `evidence:${evidence.id}`;
    addNode({ id: evidenceNodeId, type: "evidence", label: evidence.title, provider: evidence.provider });
    addEdge({
      id: `returned:${evidence.provider}:${evidence.id}`,
      source: `provider:${evidence.provider}`,
      target: evidenceNodeId,
      type: "returned",
    });
  }
  input.claims.forEach((claim, index) => {
    const claimId = `claim:${index + 1}`;
    addNode({ id: claimId, type: "claim", label: claim.text });
    claim.citation_ids.forEach((evidenceId) => addEdge({
      id: `supports:${evidenceId}:${claimId}`,
      source: `evidence:${evidenceId}`,
      target: claimId,
      type: "supports",
    }));
  });
  input.contradictions.forEach((contradiction, index) => {
    const contradictionId = `contradiction:${index + 1}`;
    addNode({ id: contradictionId, type: "contradiction", label: contradiction.summary });
    contradiction.evidenceIds.forEach((evidenceId) => addEdge({
      id: `conflicts:${evidenceId}:${contradictionId}`,
      source: `evidence:${evidenceId}`,
      target: contradictionId,
      type: "conflicts",
    }));
  });
  input.priorityItems.forEach((item) => {
    const actionId = `action:${item.id}`;
    addNode({ id: actionId, type: "action", label: item.title });
    item.evidence_ids.forEach((evidenceId) => addEdge({
      id: `prioritises:${evidenceId}:${actionId}`,
      source: `evidence:${evidenceId}`,
      target: actionId,
      type: "prioritises",
    }));
  });
  return { nodes, edges };
}

export function createQueryWorkflowRecorder(input: {
  queryId: string;
  workspaceId: string;
  mode: "fast" | "thinking";
  providerSeeds: Array<{ provider: string; connectorId?: string; required: boolean }>;
}) {
  const activities = new Map<string, ProviderActivity>();
  for (const seed of input.providerSeeds) {
    if (activities.has(seed.provider)) continue;
    activities.set(seed.provider, {
      provider: seed.provider,
      ...(seed.connectorId ? { connectorId: seed.connectorId } : {}),
      status: seed.required ? "idle" : "not-required",
      receiptCount: 0,
      evidenceIds: [],
    });
  }

  let sequence = 0;
  let latestCallCount = 0;
  const events: WorkflowEvent[] = [];
  const snapshotProviders = () => [...activities.values()]
    .map((activity) => ({ ...activity, evidenceIds: [...activity.evidenceIds] }))
    .sort((left, right) => left.provider.localeCompare(right.provider));
  const receiptCount = () => new Set([...activities.values()].flatMap((item) => item.evidenceIds)).size;

  const record = async (
    stage: WorkflowStage,
    detail: string,
    options: { callCount?: number; latencyMs?: number; errorType?: string | null } = {},
  ) => {
    if (typeof options.callCount === "number") latestCallCount = options.callCount;
    const event: WorkflowEvent = {
      sequence: ++sequence,
      stage,
      recordedAt: new Date().toISOString(),
      detail,
      providers: snapshotProviders(),
      receiptCount: receiptCount(),
      callCount: latestCallCount,
    };
    events.push(event);
    const coverage = event.providers.filter((provider) => provider.receiptCount > 0).map((provider) => provider.provider);
    await requireDb().batch([
      requireDb().prepare(
        `INSERT INTO query_steps
         (id, workspace_id, query_run_id, sequence, operation, mode, filters_json,
          result_count, latency_ms, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        createId("step"), input.workspaceId, input.queryId, event.sequence, stage, input.mode,
        JSON.stringify({ detail, providers: event.providers, receiptCount: event.receiptCount }),
        event.receiptCount, options.latencyMs ?? 0, stage,
      ),
      requireDb().prepare(
        `UPDATE query_runs SET status = ?, provider_coverage_json = ?, source_count = ?,
         call_count = ?, latency_ms = ?, error_type = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND workspace_id = ?`,
      ).bind(
        stage, JSON.stringify(coverage), event.receiptCount, event.callCount,
        options.latencyMs ?? 0, options.errorType ?? null, input.queryId, input.workspaceId,
      ),
    ]);
    return event;
  };

  const markQuerying = async (providers: string[], detail: string, callCount: number) => {
    for (const provider of providers) {
      const activity = activities.get(provider);
      if (!activity || activity.status === "not-required") continue;
      activity.status = "querying";
    }
    return record("retrieving", detail, { callCount });
  };

  const markResponse = async (response: {
    providers: string[];
    ok: boolean;
    latencyMs: number;
    callCount: number;
    evidenceByProvider: Map<string, string[]>;
  }) => {
    for (const provider of response.providers) {
      const activity = activities.get(provider);
      if (!activity || activity.status === "not-required") continue;
      const ids = response.evidenceByProvider.get(provider) ?? [];
      activity.evidenceIds = [...new Set([...activity.evidenceIds, ...ids])];
      activity.receiptCount = activity.evidenceIds.length;
      activity.latencyMs = (activity.latencyMs ?? 0) + response.latencyMs;
      if (!response.ok) activity.status = activity.receiptCount ? "partial" : "failed";
      else activity.status = activity.receiptCount ? "received" : "partial";
    }
    return record(
      "retrieving",
      response.ok ? "HydraDB returned a provider response." : "A HydraDB provider query failed.",
      { callCount: response.callCount, latencyMs: response.latencyMs },
    );
  };

  const persistReceipt = async (payload: { workflow: LiveProofState; result: Record<string, unknown> }) => {
    const receiptJson = JSON.stringify(payload);
    await requireDb().prepare(
      `INSERT INTO query_receipts
       (id, workspace_id, query_run_id, schema_version, receipt_json, receipt_hash)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(
      createId("receipt"), input.workspaceId, input.queryId, payload.workflow.schemaVersion,
      receiptJson, await sha256(receiptJson),
    ).run();
  };

  return {
    record,
    markQuerying,
    markResponse,
    persistReceipt,
    providers: snapshotProviders,
    events: () => events.map((event) => ({
      ...event,
      providers: event.providers.map((provider) => ({ ...provider, evidenceIds: [...provider.evidenceIds] })),
    })),
  };
}
