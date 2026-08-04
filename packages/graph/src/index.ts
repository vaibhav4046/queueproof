import { connectorStateSchema, groundedAnswerContractSchema, type ExecutionPacket } from "../../contracts/src";
import type { z } from "zod";

/**
 * Evidence graph — derived at read time from an ExecutionPacket, an /api/ask
 * response, or live `connectors` / `action_proposals` rows, never persisted. See
 * ARCHITECTURE.md "Evidence graph" for what each node/edge type maps to in the real
 * schema, and which dormant tables (`task_dependencies`, `entity_links`,
 * `commitments`, `canonical_entities`, `entity_aliases`) this deliberately does not
 * read.
 */

export type GraphNodeType = "source" | "claim" | "contradiction" | "task" | "action" | "connector" | "approval" | "receipt";
export type GraphEdgeType =
  | "SUPPORTS"
  | "REFUTES"
  | "DEPENDS_ON"
  | "RESOLVES"
  | "ORIGINATED_FROM"
  | "REQUIRES_APPROVAL"
  | "EXECUTED_AS";

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

/**
 * Everything below reads live `connectors` / `action_proposals` / `action_approvals`
 * / `action_executions` rows instead of a zod-validated contract. Those tables have
 * no schema of their own in packages/contracts (only `connectorStateSchema` is
 * typed) — callers read them with raw `db.prepare(...)` (see
 * `app/api/actions/route.ts`'s `GET`, which already joins all three action tables
 * in one query). So parsing here is defensive against arbitrary row shapes, the
 * same stance `asContradiction` takes for `z.unknown()` fields above, just applied
 * to untyped SQL rows instead of untyped JSON fields.
 */

function asConnectorRow(value: unknown): {
  id: string;
  provider: string;
  name: string;
  state: string | null;
  database: string | null;
  collection: string | null;
  lastSuccessfulSyncAt: string | null;
  lastError: string | null;
} | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" && record.id ? record.id : null;
  const provider = typeof record.provider === "string" && record.provider ? record.provider : null;
  if (!id || !provider) return null;
  return {
    id,
    provider,
    name: typeof record.name === "string" && record.name ? record.name : provider,
    // `connectors.state` is the real 14-state ConnectorState machine
    // (packages/contracts's `connectorStateSchema`, db/schema.ts's `connectors.state`).
    // An unrecognised value is dropped rather than trusted verbatim into the graph.
    state: connectorStateSchema.safeParse(record.state).success ? (record.state as string) : null,
    database: typeof record.database === "string" ? record.database : null,
    collection: typeof record.collection === "string" ? record.collection : null,
    lastSuccessfulSyncAt: typeof record.lastSuccessfulSyncAt === "string" ? record.lastSuccessfulSyncAt : null,
    lastError: typeof record.lastError === "string" ? record.lastError : null,
  };
}

function asConnectorSourceRow(value: unknown): {
  id: string;
  provider: string;
  title: string;
  excerpt: string;
  url: string | null;
  timestamp: string | null;
  authority: string | null;
  connectorId: string | null;
} | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" && record.id ? record.id : null;
  if (!id) return null;
  return {
    id,
    provider: typeof record.provider === "string" && record.provider ? record.provider : "unknown",
    title: typeof record.title === "string" ? record.title : "",
    excerpt: typeof record.excerpt === "string" ? record.excerpt : "",
    url: typeof record.url === "string" ? record.url : null,
    timestamp: typeof record.timestamp === "string" ? record.timestamp : null,
    authority: typeof record.authority === "string" ? record.authority : null,
    connectorId: typeof record.connectorId === "string" && record.connectorId ? record.connectorId : null,
  };
}

/**
 * Derive a graph from live `connectors` rows and the `source_references` rows they
 * produced. A separate entry point from deriveGraphFromPacket/deriveGraphFromAskResult
 * because neither `sourceReferenceSchema` nor `ExecutionPacket.evidence[]` carries a
 * `connectorId` — `lib/server/queue.ts`'s `evidenceFromHydra` reads `connector.id`
 * onto its internal `Evidence` type, but the `input.evidence = evidences.map(...)`
 * assignment in `generateQueueForWorkspace` (lib/server/queue.ts) shapes that into
 * `sourceReferenceSchema` for the packet, which has no `connectorId` field, so it is
 * dropped before the packet is built. A `connector` node keyed off `evidence.provider`
 * instead — the only connector-shaped field the packet/ask-result contracts do carry —
 * would silently merge two different connectors that share one provider (two Slack
 * workspaces, for example), manufacturing a false identity instead of an absent one.
 * So this reads the real `connectorId` foreign key directly from `source_references`
 * instead of deriving from the packet/ask-result contracts at all.
 *
 * Node/edge mapping (every one traceable to a real column, see ARCHITECTURE.md):
 *  - one `connector` node per row with a string `id` and `provider`
 *    (`connectors.id` / `connectors.provider`, db/schema.ts).
 *  - one `source` node per row with a string `id`, same shape as the source nodes
 *    the other two derive functions produce.
 *  - one `ORIGINATED_FROM` edge per source row whose `connectorId`
 *    (`source_references.connector_id`) matches a known connector node. A source
 *    with no connector id, or one that does not match a row in `connectors`
 *    (a document upload, which is never connector-owned), gets no edge — the same
 *    "dangling reference is not a crash" stance the rest of this file takes.
 */
export function deriveGraphFromConnectors(connectors: readonly unknown[], sources: readonly unknown[]): EvidenceGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const knownConnectorNodeIds = new Set<string>();

  for (const raw of connectors) {
    const connector = asConnectorRow(raw);
    if (!connector) continue;
    const connectorNodeId = `connector:${connector.id}`;
    if (knownConnectorNodeIds.has(connectorNodeId)) continue;
    knownConnectorNodeIds.add(connectorNodeId);
    nodes.push({
      id: connectorNodeId,
      type: "connector",
      label: connector.name,
      data: {
        provider: connector.provider,
        state: connector.state,
        database: connector.database,
        collection: connector.collection,
        lastSuccessfulSyncAt: connector.lastSuccessfulSyncAt,
        lastError: connector.lastError,
      },
    });
  }

  for (const raw of sources) {
    const source = asConnectorSourceRow(raw);
    if (!source) continue;
    const sourceNodeId = `source:${source.id}`;
    nodes.push({
      id: sourceNodeId,
      type: "source",
      label: source.title || source.provider,
      data: {
        provider: source.provider,
        excerpt: source.excerpt,
        url: source.url,
        authority: source.authority,
        timestamp: source.timestamp,
      },
    });
    const connectorNodeId = source.connectorId ? `connector:${source.connectorId}` : null;
    if (connectorNodeId && knownConnectorNodeIds.has(connectorNodeId)) {
      edges.push({
        id: `edge:${sourceNodeId}->${connectorNodeId}`,
        type: "ORIGINATED_FROM",
        source: sourceNodeId,
        target: connectorNodeId,
      });
    }
  }

  return { nodes, edges };
}

function asActionProposalRow(value: unknown): {
  id: string;
  provider: string;
  actionType: string;
  evidenceIds: string[];
  riskClass: string | null;
  status: string | null;
} | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" && record.id ? record.id : null;
  if (!id) return null;
  let evidenceIds: string[] = [];
  if (Array.isArray(record.evidenceIds)) {
    evidenceIds = record.evidenceIds.filter((item): item is string => typeof item === "string");
  } else if (typeof record.evidenceIdsJson === "string") {
    // `action_proposals.evidence_ids_json` is a raw JSON text column (db/schema.ts;
    // aliased `evidenceIdsJson` by app/api/actions/route.ts's GET query). Malformed
    // JSON is not this function's problem to throw on — a proposal with no readable
    // evidence just gets no SUPPORTS edges below.
    try {
      const parsed = JSON.parse(record.evidenceIdsJson);
      if (Array.isArray(parsed)) evidenceIds = parsed.filter((item): item is string => typeof item === "string");
    } catch {
      evidenceIds = [];
    }
  }
  return {
    id,
    provider: typeof record.provider === "string" && record.provider ? record.provider : "unknown",
    actionType: typeof record.actionType === "string" && record.actionType ? record.actionType : "unknown",
    evidenceIds,
    riskClass: typeof record.riskClass === "string" ? record.riskClass : null,
    status: typeof record.status === "string" ? record.status : null,
  };
}

function asActionApprovalRow(value: unknown): { decision: string; decidedBy: string | null; decidedAt: string | null } | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const decision = typeof record.decision === "string" && record.decision ? record.decision : null;
  if (!decision) return null;
  return {
    decision,
    decidedBy: typeof record.decidedBy === "string" ? record.decidedBy : null,
    decidedAt: typeof record.decidedAt === "string" ? record.decidedAt : null,
  };
}

function asActionExecutionRow(value: unknown): {
  status: string;
  providerResponseId: string | null;
  error: string | null;
} | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const status = typeof record.status === "string" && record.status ? record.status : null;
  if (!status) return null;
  return {
    status,
    providerResponseId: typeof record.providerResponseId === "string" ? record.providerResponseId : null,
    error: typeof record.error === "string" ? record.error : null,
  };
}

function asProposalEvidenceRow(value: unknown): {
  id: string;
  provider: string;
  title: string;
  excerpt: string;
  url: string | null;
  timestamp: string | null;
} | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" && record.id ? record.id : null;
  if (!id) return null;
  return {
    id,
    provider: typeof record.provider === "string" && record.provider ? record.provider : "unknown",
    title: typeof record.title === "string" ? record.title : "",
    excerpt: typeof record.excerpt === "string" ? record.excerpt : "",
    url: typeof record.url === "string" ? record.url : null,
    timestamp: typeof record.timestamp === "string" ? record.timestamp : null,
  };
}

/**
 * Derive a graph from one `action_proposals` row plus its (at most one)
 * `action_approvals` row and `action_executions` row — the real 1:1 relations
 * db/schema.ts enforces with `uniqueIndex("action_approvals_proposal_uq")` and
 * `uniqueIndex("action_executions_proposal_uq")`, and the exact shape
 * `GET /api/actions` (app/api/actions/route.ts) already reads with one LEFT JOIN
 * per table. A separate entry point from deriveGraphFromPacket/deriveGraphFromAskResult
 * for the same reason as deriveGraphFromConnectors: neither ExecutionPacket nor
 * GroundedAnswerContract references an actual `action_proposals.id` — the packet's
 * `action` node is built from the free-text `recommended_safe_action` string, which
 * has no foreign key to a real proposal row.
 *
 * Node/edge mapping:
 *  - one `action` node for the proposal (reuses the existing `action` node type; the
 *    label is synthesised from `provider`/`actionType` since a proposal row has no
 *    single title field), with `SUPPORTS` edges from every evidence id in
 *    `evidence_ids_json` that resolves to a row in `evidence` — the same real
 *    citation requirement `app/api/actions/route.ts`'s `POST` enforces before a
 *    proposal can be created at all (every evidence id must own a `source_references`
 *    row in the workspace).
 *  - one `approval` node, only when an approval row is present (`action_approvals` is
 *    1:1 and optional — a proposal can still be pending), with a `REQUIRES_APPROVAL`
 *    edge from the action.
 *  - one `receipt` node, only when the execution row reports `status === "succeeded"`
 *    with a non-empty `providerResponseId` — the real external write confirmation
 *    (`app/api/actions/[id]/approve/route.ts` only sets `provider_response_id` after
 *    `createIssue` returns an id), with an `EXECUTED_AS` edge from the action. A
 *    pending or failed execution is not a receipt: nothing was actually written to
 *    the provider, so no node is fabricated to represent it.
 */
export function deriveGraphFromActionProposal(
  proposal: unknown,
  approval: unknown,
  execution: unknown,
  evidence: readonly unknown[],
): EvidenceGraph {
  const parsedProposal = asActionProposalRow(proposal);
  if (!parsedProposal) return { nodes: [], edges: [] };

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const actionNodeId = `action:${parsedProposal.id}`;
  nodes.push({
    id: actionNodeId,
    type: "action",
    label: `${parsedProposal.provider} ${parsedProposal.actionType}`.trim(),
    data: {
      provider: parsedProposal.provider,
      actionType: parsedProposal.actionType,
      riskClass: parsedProposal.riskClass,
      status: parsedProposal.status,
    },
  });

  const knownSourceNodeIds = new Set<string>();
  for (const raw of evidence) {
    const source = asProposalEvidenceRow(raw);
    if (!source) continue;
    const sourceNodeId = `source:${source.id}`;
    if (knownSourceNodeIds.has(sourceNodeId)) continue;
    knownSourceNodeIds.add(sourceNodeId);
    nodes.push({
      id: sourceNodeId,
      type: "source",
      label: source.title || source.provider,
      data: { provider: source.provider, excerpt: source.excerpt, url: source.url, timestamp: source.timestamp },
    });
  }
  edges.push(...supportEdges(parsedProposal.evidenceIds, actionNodeId, knownSourceNodeIds, (id) => `source:${id}`));

  const parsedApproval = asActionApprovalRow(approval);
  if (parsedApproval) {
    const approvalNodeId = `approval:${parsedProposal.id}`;
    nodes.push({
      id: approvalNodeId,
      type: "approval",
      label: parsedApproval.decision,
      data: { decision: parsedApproval.decision, decidedBy: parsedApproval.decidedBy, decidedAt: parsedApproval.decidedAt },
    });
    edges.push({
      id: `edge:${actionNodeId}->${approvalNodeId}`,
      type: "REQUIRES_APPROVAL",
      source: actionNodeId,
      target: approvalNodeId,
    });
  }

  const parsedExecution = asActionExecutionRow(execution);
  if (parsedExecution && parsedExecution.status === "succeeded" && parsedExecution.providerResponseId) {
    const receiptNodeId = `receipt:${parsedProposal.id}`;
    nodes.push({
      id: receiptNodeId,
      type: "receipt",
      label: parsedExecution.providerResponseId,
      data: { status: parsedExecution.status, providerResponseId: parsedExecution.providerResponseId },
    });
    edges.push({
      id: `edge:${actionNodeId}->${receiptNodeId}`,
      type: "EXECUTED_AS",
      source: actionNodeId,
      target: receiptNodeId,
    });
  }

  return { nodes, edges };
}
