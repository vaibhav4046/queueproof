import { groundedAnswerContractSchema, type ExecutionPacket } from "../../contracts/src";
import type { z } from "zod";

/**
 * Evidence graph — derived at read time from an ExecutionPacket or an /api/ask
 * response, never persisted. See ARCHITECTURE.md "Evidence graph" for what each
 * node/edge type maps to in the real schema, and which dormant tables
 * (`task_dependencies`, `entity_links`) this deliberately does not read.
 */

export type GraphNodeType = "source" | "claim" | "contradiction" | "task" | "action";
export type GraphEdgeType = "SUPPORTS" | "REFUTES" | "DEPENDS_ON" | "RESOLVES";

export type GraphNode = { id: string; type: GraphNodeType; label: string; data: Record<string, unknown> };
export type GraphEdge = { id: string; type: GraphEdgeType; source: string; target: string; data?: Record<string, unknown> };
export type EvidenceGraph = { nodes: GraphNode[]; edges: GraphEdge[] };

/**
 * The real shape of a successful /api/ask response — z.infer of the schema that
 * app/api/ask/route.ts actually validates its response against
 * (groundedAnswerContractSchema, packages/contracts/src/index.ts). There is no
 * separate exported type alias for it upstream, so it is inferred here rather
 * than duplicated by hand.
 */
export type GroundedAnswerContract = z.infer<typeof groundedAnswerContractSchema>;

/**
 * Contradiction items are typed `z.unknown()` at both the packet level
 * (executionPacketSchema.contradictions) and the ask-result level
 * (groundedAnswerContractSchema.contradictions), because packages/contracts
 * does not pin their shape. At runtime both call sites populate them from the
 * same GroundedContradiction shape — see lib/server/synthesis.ts
 * (`contradictions()`) and lib/server/queue.ts (`clusterContradictions()`):
 * `{ summary: string, evidenceIds: string[], providers: string[] }`. This
 * reads that shape defensively instead of trusting it.
 */
function asContradiction(value: unknown): { summary: string; evidenceIds: string[]; providers: string[] } | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const summary = typeof record.summary === "string" ? record.summary : null;
  if (!summary) return null;
  const evidenceIds = Array.isArray(record.evidenceIds)
    ? record.evidenceIds.filter((id): id is string => typeof id === "string")
    : [];
  const providers = Array.isArray(record.providers)
    ? record.providers.filter((value) => typeof value === "string")
    : [];
  return { summary, evidenceIds, providers };
}

/**
 * Build one `contradiction` node per recognisable entry in `contradictions`,
 * with a `REFUTES` edge from each of its referenced source nodes — but only
 * for source ids that already exist in this graph. A contradiction referring
 * to an evidence id outside the current evidence set (malformed data, a
 * stale reference) is not enough reason to fail the whole derivation; the
 * node is still added, just without an edge for that id.
 *
 * Shared by deriveGraphFromPacket and deriveGraphFromAskResult so the two
 * derivations do not maintain separate copies of this logic.
 */
function contradictionGraphParts(
  contradictions: readonly unknown[],
  knownSourceNodeIds: ReadonlySet<string>,
  sourceNodeId: (evidenceId: string) => string,
  contradictionNodeId: (index: number) => string,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  contradictions.forEach((raw, index) => {
    const contradiction = asContradiction(raw);
    if (!contradiction) return;
    const nodeId = contradictionNodeId(index);
    nodes.push({
      id: nodeId,
      type: "contradiction",
      label: contradiction.summary,
      data: { providers: contradiction.providers, evidenceIds: contradiction.evidenceIds },
    });
    for (const evidenceId of contradiction.evidenceIds) {
      const fromId = sourceNodeId(evidenceId);
      if (!knownSourceNodeIds.has(fromId)) continue;
      edges.push({ id: `edge:${fromId}->${nodeId}`, type: "REFUTES", source: fromId, target: nodeId });
    }
  });
  return { nodes, edges };
}

/**
 * `SUPPORTS` edges from already-known source nodes to one target (a task or a
 * claim). Ids that do not resolve to a known source node are skipped rather
 * than thrown on — the same defensive stance as contradictionGraphParts, and
 * for the same reason: a dangling reference in retrieved/derived data is not
 * a crash, it is a node that stays unsupported.
 */
function supportEdges(
  evidenceIds: readonly string[],
  targetNodeId: string,
  knownSourceNodeIds: ReadonlySet<string>,
  sourceNodeId: (evidenceId: string) => string,
): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  for (const evidenceId of evidenceIds) {
    const fromId = sourceNodeId(evidenceId);
    if (!knownSourceNodeIds.has(fromId) || seen.has(fromId)) continue;
    seen.add(fromId);
    edges.push({ id: `edge:${fromId}->${targetNodeId}`, type: "SUPPORTS", source: fromId, target: targetNodeId });
  }
  return edges;
}

/**
 * Derive an evidence graph from one queue ExecutionPacket.
 *
 * Node/edge mapping (every one traceable to a real field — see ARCHITECTURE.md):
 *  - one `task` node for the packet itself (`task:${taskId}`)
 *  - one `source` node per `packet.evidence[]` item (`sourceReferenceSchema`,
 *    packages/contracts/src/index.ts), each with a `SUPPORTS` edge to the task.
 *    This mirrors the real `task_evidence.relation` column, which is always
 *    `'supports'` in the schema default and in every INSERT in
 *    lib/server/queue.ts — there is no REFUTES relation from evidence to a
 *    task in the real data, so none is invented here.
 *  - one `contradiction` node per `packet.contradictions[]` entry, with
 *    `REFUTES` edges from its referenced evidence.
 *  - one `action` node when the packet carries a non-empty
 *    `recommended_safe_action`, with a `RESOLVES` edge from the task. The
 *    schema defaults this field to a non-empty string, so in practice this
 *    node is present on every packet; it is still gated on the actual value
 *    rather than assumed.
 *
 * `why_above_next` is deliberately not represented here: it compares this
 * task's score against a different task's, it does not describe a
 * dependency between them, so no DEPENDS_ON edge is derived from it.
 */
export function deriveGraphFromPacket(packet: ExecutionPacket, taskId: string): EvidenceGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const taskNodeId = `task:${taskId}`;

  nodes.push({
    id: taskNodeId,
    type: "task",
    label: packet.task?.title || taskId,
    data: {
      objective: packet.task?.objective ?? null,
      status: packet.status ?? null,
      priorityScore: packet.task?.priority_score ?? null,
      confidence: packet.task?.confidence ?? null,
    },
  });

  const knownSourceNodeIds = new Set<string>();
  for (const evidence of packet.evidence ?? []) {
    const sourceId = evidence?.sourceId;
    if (!sourceId) continue;
    const sourceNodeId = `source:${sourceId}`;
    if (knownSourceNodeIds.has(sourceNodeId)) continue;
    knownSourceNodeIds.add(sourceNodeId);
    nodes.push({
      id: sourceNodeId,
      type: "source",
      label: evidence.title || evidence.provider,
      data: {
        provider: evidence.provider,
        excerpt: evidence.excerpt,
        url: evidence.url ?? null,
        authority: evidence.authority,
        timestamp: evidence.timestamp ?? null,
      },
    });
    edges.push({ id: `edge:${sourceNodeId}->${taskNodeId}`, type: "SUPPORTS", source: sourceNodeId, target: taskNodeId });
  }

  const { nodes: contradictionNodes, edges: contradictionEdges } = contradictionGraphParts(
    packet.contradictions ?? [],
    knownSourceNodeIds,
    (evidenceId) => `source:${evidenceId}`,
    (index) => `contradiction:${taskId}:${index}`,
  );
  nodes.push(...contradictionNodes);
  edges.push(...contradictionEdges);

  const recommendedAction = packet.recommended_safe_action?.trim();
  if (recommendedAction) {
    const actionNodeId = `action:${taskId}`;
    nodes.push({
      id: actionNodeId,
      type: "action",
      label: recommendedAction,
      data: { approvalRequired: packet.permissions?.approval_required ?? null },
    });
    edges.push({ id: `edge:${taskNodeId}->${actionNodeId}`, type: "RESOLVES", source: taskNodeId, target: actionNodeId });
  }

  return { nodes, edges };
}

/**
 * Derive an evidence graph from a validated /api/ask response
 * (GroundedAnswerContract). This is the shape the Evidence tab actually
 * fetches results from — an ask/query run, not a queue packet — so the
 * source list here is `citations` (not `evidence`, which does not exist on
 * this contract) and tasks come from `priority_items`, of which there are
 * normally zero or one (app/api/ask/route.ts caps `relatedPriority` at one).
 *
 * Node/edge mapping:
 *  - one `source` node per `citations[]` item (`groundedCitationSchema`).
 *  - one `claim` node per `claims[]` item, with `SUPPORTS` edges from the
 *    sources named in its `citation_ids`.
 *  - one `task` node per `priority_items[]` entry, with `SUPPORTS` edges from
 *    the sources named in its `evidence_ids`.
 *  - one `contradiction` node per `contradictions[]` entry (same shape as the
 *    packet path — see contradictionGraphParts), with `REFUTES` edges.
 *  - one `action` node per priority item with a non-empty
 *    `recommended_next_safe_action`, with a `RESOLVES` edge from that task.
 */
export function deriveGraphFromAskResult(result: GroundedAnswerContract): EvidenceGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  const knownSourceNodeIds = new Set<string>();
  for (const citation of result.citations ?? []) {
    if (!citation?.id) continue;
    const sourceNodeId = `source:${citation.id}`;
    if (knownSourceNodeIds.has(sourceNodeId)) continue;
    knownSourceNodeIds.add(sourceNodeId);
    nodes.push({
      id: sourceNodeId,
      type: "source",
      label: citation.title || citation.provider,
      data: {
        provider: citation.provider,
        excerpt: citation.excerpt,
        url: citation.url ?? null,
        timestamp: citation.timestamp ?? null,
      },
    });
  }

  (result.claims ?? []).forEach((claim, index) => {
    const claimNodeId = `claim:${index}`;
    nodes.push({
      id: claimNodeId,
      type: "claim",
      label: claim.text,
      data: { providers: claim.providers },
    });
    edges.push(...supportEdges(claim.citation_ids ?? [], claimNodeId, knownSourceNodeIds, (id) => `source:${id}`));
  });

  for (const item of result.priority_items ?? []) {
    if (!item?.id) continue;
    const taskNodeId = `task:${item.id}`;
    nodes.push({
      id: taskNodeId,
      type: "task",
      label: item.title,
      data: { status: item.status, score: item.score, confidence: item.confidence },
    });
    edges.push(...supportEdges(item.evidence_ids ?? [], taskNodeId, knownSourceNodeIds, (id) => `source:${id}`));

    const recommendedAction = item.recommended_next_safe_action?.trim();
    if (recommendedAction) {
      const actionNodeId = `action:${item.id}`;
      nodes.push({
        id: actionNodeId,
        type: "action",
        label: recommendedAction,
        data: { approvalRequired: item.approval_required ?? null },
      });
      edges.push({ id: `edge:${taskNodeId}->${actionNodeId}`, type: "RESOLVES", source: taskNodeId, target: actionNodeId });
    }
  }

  const { nodes: contradictionNodes, edges: contradictionEdges } = contradictionGraphParts(
    result.contradictions ?? [],
    knownSourceNodeIds,
    (evidenceId) => `source:${evidenceId}`,
    (index) => `contradiction:ask:${index}`,
  );
  nodes.push(...contradictionNodes);
  edges.push(...contradictionEdges);

  return { nodes, edges };
}
