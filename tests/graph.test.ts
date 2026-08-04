import { describe, expect, it } from "vitest";
import {
  deriveGraphFromActionProposal,
  deriveGraphFromAskResult,
  deriveGraphFromConnectors,
  deriveGraphFromPacket,
  type GraphEdge,
  type GraphNode,
  type GroundedAnswerContract,
} from "../packages/graph/src";
import type { ExecutionPacket } from "../packages/contracts/src";

/**
 * packages/graph has no package.json (no sibling package under packages/ does — see
 * pnpm-workspace.yaml, whose "packages" list is just "."). Tests for every other
 * packages/* module live under tests/, not colocated with the source, because
 * vitest.config.ts only includes "tests/**\/*.test.ts". This file follows that
 * existing convention rather than colocating with packages/graph/src.
 */

function basePacket(overrides: Partial<ExecutionPacket> = {}): ExecutionPacket {
  return {
    packet_id: "packet-1",
    workspace_id: "ws-1",
    created_at: "2031-04-08T00:00:00.000Z",
    policy_version: "queueproof-default-2.0.0",
    task: {
      title: "Ship the AuthShield token change",
      objective: "Reduce operator token lifetime to fifteen minutes.",
      owner: "Priya Raman",
      project: "AuthShield",
      deadline: null,
      priority_score: 72,
      confidence: 0.8,
    },
    why_now: [],
    constraints: [],
    dependencies: [],
    acceptance_criteria: [],
    evidence: [],
    contradictions: [],
    missing_information: [],
    score_breakdown: {},
    penalties: {},
    active_formula: "",
    recommended_safe_action: "Review the cited evidence before taking action.",
    provider_coverage: [],
    deduplicated_tasks: [],
    status: "open",
    recommended_agent: "human",
    permissions: { read: [], write: [], approval_required: true },
    completion_callback: { type: "mcp_tool", tool: "queueproof_report_execution_result" },
    ...overrides,
  } as ExecutionPacket;
}

function evidenceItem(overrides: Partial<ExecutionPacket["evidence"][number]> = {}): ExecutionPacket["evidence"][number] {
  return {
    sourceId: "source-1",
    provider: "linear",
    externalId: "ENG-456",
    title: "ENG-456: reduce token lifetime",
    excerpt: "AuthShield operator token lifetime will be reduced to fifteen minutes.",
    timestamp: null,
    ingestionTimestamp: null,
    url: null,
    authority: "primary",
    metadata: {},
    ...overrides,
  };
}

function baseAskResult(overrides: Partial<GroundedAnswerContract> = {}): GroundedAnswerContract {
  return {
    answer: "AuthShield token lifetime will be reduced to fifteen minutes. [1]",
    claims: [],
    citations: [],
    priority_items: [],
    contradictions: [],
    missing_information: [],
    retrieval_receipt: {
      query_id: "run-1",
      hydradb_mode: "fast",
      routing_reason: "direct lookup",
      hydradb_call_count: 1,
      total_latency_ms: 120,
      provider_coverage: [],
      receipt_count: 0,
      metadata_filters: {},
      graph_usage: false,
      estimated_cost_units: 1,
      timestamp: "2031-04-08T00:00:00.000Z",
    },
    routing_reason: "direct lookup",
    ...overrides,
  } as GroundedAnswerContract;
}

const nodesByType = (nodes: GraphNode[], type: GraphNode["type"]) => nodes.filter((node) => node.type === type);
const edgesByType = (edges: GraphEdge[], type: GraphEdge["type"]) => edges.filter((edge) => edge.type === type);

describe("deriveGraphFromPacket", () => {
  it("returns just a task node for a packet with no evidence and no action", () => {
    const graph = deriveGraphFromPacket(basePacket({ recommended_safe_action: "" }), "task-1");
    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0]).toMatchObject({ id: "task:task-1", type: "task" });
    expect(graph.edges).toHaveLength(0);
  });

  it("adds one source node and one SUPPORTS edge per evidence item", () => {
    const packet = basePacket({
      recommended_safe_action: "",
      evidence: [evidenceItem({ sourceId: "src-a" }), evidenceItem({ sourceId: "src-b", provider: "github" })],
    });
    const graph = deriveGraphFromPacket(packet, "task-1");
    expect(nodesByType(graph.nodes, "source")).toHaveLength(2);
    expect(nodesByType(graph.nodes, "task")).toHaveLength(1);
    expect(edgesByType(graph.edges, "SUPPORTS")).toHaveLength(2);
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "source:src-a", target: "task:task-1", type: "SUPPORTS" }),
        expect.objectContaining({ source: "source:src-b", target: "task:task-1", type: "SUPPORTS" }),
      ]),
    );
  });

  it("adds one contradiction node with REFUTES edges from both referenced sources", () => {
    const packet = basePacket({
      recommended_safe_action: "",
      evidence: [evidenceItem({ sourceId: "src-a" }), evidenceItem({ sourceId: "src-b" })],
      contradictions: [
        { summary: "The cited records disagree on the deadline.", evidenceIds: ["src-a", "src-b"], providers: ["linear", "github"] },
      ],
    });
    const graph = deriveGraphFromPacket(packet, "task-1");
    expect(nodesByType(graph.nodes, "contradiction")).toHaveLength(1);
    const refutes = edgesByType(graph.edges, "REFUTES");
    expect(refutes).toHaveLength(2);
    expect(refutes.map((edge) => edge.source).sort()).toEqual(["source:src-a", "source:src-b"]);
    expect(refutes.every((edge) => edge.target === "contradiction:task-1:0")).toBe(true);
  });

  it("adds one action node with a RESOLVES edge when recommended_safe_action is present", () => {
    const graph = deriveGraphFromPacket(basePacket({ recommended_safe_action: "Send the fix ETA." }), "task-1");
    expect(nodesByType(graph.nodes, "action")).toHaveLength(1);
    expect(edgesByType(graph.edges, "RESOLVES")).toEqual([
      { id: "edge:task:task-1->action:task-1", type: "RESOLVES", source: "task:task-1", target: "action:task-1" },
    ]);
  });

  it.each([
    ["an empty string", ""],
    ["a whitespace-only string", "   "],
  ])("omits the action node for %s", (_label, recommendedAction) => {
    const graph = deriveGraphFromPacket(basePacket({ recommended_safe_action: recommendedAction }), "task-1");
    expect(nodesByType(graph.nodes, "action")).toHaveLength(0);
  });

  it("does not throw on malformed or missing optional evidence fields", () => {
    const packet = basePacket({
      evidence: [
        // sourceId missing entirely — must be skipped, not thrown on.
        { ...evidenceItem(), sourceId: undefined as unknown as string },
        evidenceItem({ sourceId: "src-ok", url: null, timestamp: null }),
      ],
      contradictions: [
        null,
        "not an object",
        { summary: "missing evidenceIds field entirely" },
        { summary: "evidenceIds has the wrong element type", evidenceIds: [1, 2, "src-ok"], providers: [] },
      ] as unknown as ExecutionPacket["contradictions"],
    });
    expect(() => deriveGraphFromPacket(packet, "task-1")).not.toThrow();
    const graph = deriveGraphFromPacket(packet, "task-1");
    expect(nodesByType(graph.nodes, "source")).toHaveLength(1);
    // Two contradictions carried a string summary; the others are silently dropped.
    expect(nodesByType(graph.nodes, "contradiction")).toHaveLength(2);
  });

  it("does not represent why_above_next as a graph edge", () => {
    const packet = basePacket({
      why_above_next: { leaderId: "task-1", runnerUpId: "task-2", scoreDelta: 4, components: [], summary: "Leads by 4 points." },
    } as Partial<ExecutionPacket>);
    const graph = deriveGraphFromPacket(packet, "task-1");
    expect(edgesByType(graph.edges, "DEPENDS_ON")).toHaveLength(0);
  });
});

describe("deriveGraphFromAskResult", () => {
  it("returns an empty graph for a result with no citations, claims, or priority items", () => {
    const graph = deriveGraphFromAskResult(baseAskResult());
    expect(graph.nodes).toHaveLength(0);
    expect(graph.edges).toHaveLength(0);
  });

  it("adds a source node per citation and a claim node with SUPPORTS edges from its cited sources", () => {
    const result = baseAskResult({
      citations: [
        { id: "cit-a", provider: "linear", title: "ENG-456", excerpt: "…", timestamp: null, url: null },
        { id: "cit-b", provider: "github", title: "PR #12", excerpt: "…", timestamp: null, url: null },
      ],
      claims: [{ text: "ENG-456 is still open.", citation_ids: ["cit-a", "cit-b"], providers: ["linear", "github"] }],
    });
    const graph = deriveGraphFromAskResult(result);
    expect(nodesByType(graph.nodes, "source")).toHaveLength(2);
    expect(nodesByType(graph.nodes, "claim")).toHaveLength(1);
    const supports = edgesByType(graph.edges, "SUPPORTS");
    expect(supports).toHaveLength(2);
    expect(supports.every((edge) => edge.target === "claim:0")).toBe(true);
  });

  it("adds a task node per priority item with a RESOLVES edge to its action", () => {
    const result = baseAskResult({
      citations: [{ id: "cit-a", provider: "linear", title: "ENG-456", excerpt: "…", timestamp: null, url: null }],
      priority_items: [
        {
          id: "task-1", title: "Ship ENG-456", normalized_entity: "AuthShield", owner: null, due_date: null,
          status: "open", score: 61, score_breakdown: {}, penalties: {}, why_now: [],
          recommended_next_safe_action: "Send the fix ETA.", evidence_ids: ["cit-a"], disagreements: [],
          confidence: 0.6, provider_coverage: ["linear"], deduplicated_tasks: [], approval_required: true,
        },
      ],
    });
    const graph = deriveGraphFromAskResult(result);
    expect(nodesByType(graph.nodes, "task")).toHaveLength(1);
    expect(nodesByType(graph.nodes, "action")).toHaveLength(1);
    expect(edgesByType(graph.edges, "SUPPORTS")).toEqual([
      expect.objectContaining({ source: "source:cit-a", target: "task:task-1" }),
    ]);
    expect(edgesByType(graph.edges, "RESOLVES")).toEqual([
      { id: "edge:task:task-1->action:task-1", type: "RESOLVES", source: "task:task-1", target: "action:task-1" },
    ]);
  });

  it("adds a contradiction node with REFUTES edges scoped to known sources only", () => {
    const result = baseAskResult({
      citations: [{ id: "cit-a", provider: "linear", title: "ENG-456", excerpt: "…", timestamp: null, url: null }],
      contradictions: [
        // "cit-missing" has no matching citation, so only one REFUTES edge should appear.
        { summary: "Dates disagree.", evidenceIds: ["cit-a", "cit-missing"], providers: ["linear"] },
      ],
    });
    const graph = deriveGraphFromAskResult(result);
    expect(nodesByType(graph.nodes, "contradiction")).toHaveLength(1);
    const refutes = edgesByType(graph.edges, "REFUTES");
    expect(refutes).toHaveLength(1);
    expect(refutes[0]).toMatchObject({ source: "source:cit-a", target: "contradiction:ask:0" });
  });

  it("does not throw when priority items or citations are missing optional fields", () => {
    const result = baseAskResult({
      citations: [{ id: "cit-a", provider: "linear", title: "", excerpt: "", timestamp: null, url: null }],
      priority_items: [
        {
          id: "task-1", title: "Untitled", normalized_entity: "x", owner: null, due_date: null,
          status: "open", score: 0, score_breakdown: {}, penalties: {}, why_now: [],
          recommended_next_safe_action: "", evidence_ids: [], disagreements: [],
          confidence: 0, provider_coverage: [], deduplicated_tasks: [], approval_required: false,
        },
      ],
    });
    expect(() => deriveGraphFromAskResult(result)).not.toThrow();
    const graph = deriveGraphFromAskResult(result);
    expect(nodesByType(graph.nodes, "action")).toHaveLength(0);
  });
});

describe("deriveGraphFromConnectors", () => {
  it("adds one connector node per row with a real state", () => {
    const graph = deriveGraphFromConnectors(
      [{ id: "conn-1", provider: "linear", name: "Linear (Northwind)", state: "data_verified", database: "db-1", collection: null, lastSuccessfulSyncAt: "2031-04-08T00:00:00.000Z", lastError: null }],
      [],
    );
    expect(graph.nodes).toEqual([
      expect.objectContaining({
        id: "connector:conn-1",
        type: "connector",
        data: expect.objectContaining({ provider: "linear", state: "data_verified" }),
      }),
    ]);
  });

  it("drops an unrecognised connector state rather than trusting it verbatim", () => {
    const graph = deriveGraphFromConnectors(
      [{ id: "conn-1", provider: "linear", name: "Linear", state: "not_a_real_state" }],
      [],
    );
    expect(graph.nodes[0]).toMatchObject({ data: expect.objectContaining({ state: null }) });
  });

  it("adds an ORIGINATED_FROM edge from a source to the connector it names", () => {
    const graph = deriveGraphFromConnectors(
      [{ id: "conn-1", provider: "linear", name: "Linear" }],
      [{ id: "src-1", provider: "linear", title: "ENG-456", excerpt: "…", connectorId: "conn-1" }],
    );
    expect(nodesByType(graph.nodes, "source")).toHaveLength(1);
    expect(edgesByType(graph.edges, "ORIGINATED_FROM")).toEqual([
      { id: "edge:source:src-1->connector:conn-1", type: "ORIGINATED_FROM", source: "source:src-1", target: "connector:conn-1" },
    ]);
  });

  it("omits the edge for a source whose connectorId does not resolve to a known connector", () => {
    const graph = deriveGraphFromConnectors(
      [{ id: "conn-1", provider: "linear", name: "Linear" }],
      [
        { id: "src-1", provider: "document", title: "Handbook.pdf", excerpt: "…", connectorId: null },
        { id: "src-2", provider: "linear", title: "stale", excerpt: "…", connectorId: "conn-deleted" },
      ],
    );
    expect(nodesByType(graph.nodes, "source")).toHaveLength(2);
    expect(graph.edges).toHaveLength(0);
  });

  it("does not throw on malformed connector or source rows", () => {
    expect(() => deriveGraphFromConnectors(
      [null, "not an object", {}, { id: "conn-1" }],
      [null, {}, { id: "src-1" }],
    )).not.toThrow();
    const graph = deriveGraphFromConnectors(
      [null, "not an object", {}, { id: "conn-1" }],
      [null, {}, { id: "src-1" }],
    );
    // { id: "conn-1" } has no provider, so it is dropped; only the valid source row survives.
    expect(nodesByType(graph.nodes, "connector")).toHaveLength(0);
    expect(nodesByType(graph.nodes, "source")).toHaveLength(1);
  });
});

describe("deriveGraphFromActionProposal", () => {
  it("returns an empty graph for a malformed proposal", () => {
    expect(deriveGraphFromActionProposal(null, null, null, [])).toEqual({ nodes: [], edges: [] });
    expect(deriveGraphFromActionProposal({ noId: true }, null, null, [])).toEqual({ nodes: [], edges: [] });
  });

  it("adds one action node with SUPPORTS edges from its cited evidence, and no approval or receipt when pending", () => {
    const graph = deriveGraphFromActionProposal(
      { id: "action-1", provider: "linear", actionType: "create_issue", evidenceIds: ["src-a", "src-b"], riskClass: "low", status: "proposed" },
      null,
      null,
      [
        { id: "src-a", provider: "linear", title: "ENG-456", excerpt: "…" },
        { id: "src-b", provider: "slack", title: "thread", excerpt: "…" },
      ],
    );
    expect(nodesByType(graph.nodes, "action")).toEqual([
      expect.objectContaining({ id: "action:action-1", data: expect.objectContaining({ status: "proposed" }) }),
    ]);
    expect(edgesByType(graph.edges, "SUPPORTS")).toHaveLength(2);
    expect(nodesByType(graph.nodes, "approval")).toHaveLength(0);
    expect(nodesByType(graph.nodes, "receipt")).toHaveLength(0);
  });

  it("parses evidence_ids_json when evidenceIds is not already an array", () => {
    const graph = deriveGraphFromActionProposal(
      { id: "action-1", provider: "linear", actionType: "create_issue", evidenceIdsJson: JSON.stringify(["src-a"]), status: "proposed" },
      null,
      null,
      [{ id: "src-a", provider: "linear", title: "ENG-456", excerpt: "…" }],
    );
    expect(edgesByType(graph.edges, "SUPPORTS")).toEqual([
      expect.objectContaining({ source: "source:src-a", target: "action:action-1" }),
    ]);
  });

  it("does not throw on unparseable evidence_ids_json", () => {
    expect(() => deriveGraphFromActionProposal(
      { id: "action-1", provider: "linear", actionType: "create_issue", evidenceIdsJson: "{not json", status: "proposed" },
      null,
      null,
      [],
    )).not.toThrow();
  });

  it("adds an approval node with a REQUIRES_APPROVAL edge when an approval row is present", () => {
    const graph = deriveGraphFromActionProposal(
      { id: "action-1", provider: "linear", actionType: "create_issue", evidenceIds: [], status: "proposed" },
      { decision: "approved", decidedBy: "user:owner", decidedAt: "2031-04-08T00:00:00.000Z" },
      null,
      [],
    );
    expect(nodesByType(graph.nodes, "approval")).toEqual([
      expect.objectContaining({ id: "approval:action-1", data: expect.objectContaining({ decision: "approved" }) }),
    ]);
    expect(edgesByType(graph.edges, "REQUIRES_APPROVAL")).toEqual([
      { id: "edge:action:action-1->approval:action-1", type: "REQUIRES_APPROVAL", source: "action:action-1", target: "approval:action-1" },
    ]);
  });

  it("adds a receipt node with an EXECUTED_AS edge only when execution succeeded with a provider response id", () => {
    const graph = deriveGraphFromActionProposal(
      { id: "action-1", provider: "linear", actionType: "create_issue", evidenceIds: [], status: "executed" },
      { decision: "approved", decidedBy: "user:owner", decidedAt: "2031-04-08T00:00:00.000Z" },
      { status: "succeeded", providerResponseId: "ENG-999", error: null },
      [],
    );
    expect(nodesByType(graph.nodes, "receipt")).toEqual([
      expect.objectContaining({ id: "receipt:action-1", label: "ENG-999" }),
    ]);
    expect(edgesByType(graph.edges, "EXECUTED_AS")).toEqual([
      { id: "edge:action:action-1->receipt:action-1", type: "EXECUTED_AS", source: "action:action-1", target: "receipt:action-1" },
    ]);
  });

  it.each([
    ["a pending execution", { status: "pending", providerResponseId: null, error: null }],
    ["a failed execution", { status: "failed", providerResponseId: null, error: "Linear execution failed." }],
  ])("omits the receipt node for %s", (_label, execution) => {
    const graph = deriveGraphFromActionProposal(
      { id: "action-1", provider: "linear", actionType: "create_issue", evidenceIds: [], status: "proposed" },
      null,
      execution,
      [],
    );
    expect(nodesByType(graph.nodes, "receipt")).toHaveLength(0);
    expect(edgesByType(graph.edges, "EXECUTED_AS")).toHaveLength(0);
  });

  it("does not throw on malformed approval or execution rows", () => {
    expect(() => deriveGraphFromActionProposal(
      { id: "action-1", provider: "linear", actionType: "create_issue", evidenceIds: [], status: "proposed" },
      "not an object",
      42,
      [null, "not an object", {}],
    )).not.toThrow();
  });
});
