import { describe, expect, it } from "vitest";
import { actionProposalSchema, connectorStateSchema, executionPacketSchema, queryRequestSchema } from "../packages/contracts/src";

describe("public contracts", () => {
  it("accepts all declared connector proof states", () => {
    expect(connectorStateSchema.options).toContain("data_verified");
    expect(connectorStateSchema.options).toContain("permission_insufficient");
    expect(connectorStateSchema.options).toContain("rate_limited");
  });
  // This test previously passed for the wrong reason: it supplied
  // idempotencyKey: "123", which fails the schema's .min(16) on its own, so the
  // assertion held even with the evidence-grounding rule removed. The product's central
  // promise — that no action can be proposed without evidence — was therefore unpinned.
  // The proposal below is valid in every respect except evidenceIds, and the positive
  // control proves the only reason the negative case fails is the missing evidence.
  const groundedProposal = {
    provider: "linear",
    accountScope: "team",
    resourceId: "LIN-1",
    actionType: "comment",
    payload: {},
    reason: "Follow up",
    evidenceIds: ["src-1"],
    riskClass: "low",
    idempotencyKey: "idem-0123456789abcdef",
  };

  it("accepts an action proposal that cites evidence", () => {
    expect(actionProposalSchema.safeParse(groundedProposal).success).toBe(true);
  });

  it("rejects an otherwise-valid action proposal that cites no evidence", () => {
    const result = actionProposalSchema.safeParse({ ...groundedProposal, evidenceIds: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("evidenceIds"))).toBe(true);
    }
  });
  it("requires evidence and approval semantics in execution packets", () => {
    const packet = {
      packet_id: "pkt-1", workspace_id: "ws-1", created_at: "2026-07-31T12:00:00.000Z",
      policy_version: "queueproof-default-1.0.0",
      task: { title: "Ship", objective: "Ship safely", owner: null, project: null, deadline: null,
        priority_score: 80, confidence: 0.8 },
      why_now: ["Commitment due"], constraints: [], dependencies: [], acceptance_criteria: ["Checks pass"],
      evidence: [{ sourceId: "src-1", provider: "linear", externalId: "LIN-1", title: "Issue",
        excerpt: "Ship the verified fix by Friday.", timestamp: "2026-07-31T11:00:00.000Z",
        ingestionTimestamp: "2026-07-31T11:01:00.000Z", url: "https://linear.app/acme/LIN-1",
        authority: "primary", metadata: {} }],
      contradictions: [], missing_information: [], recommended_agent: "codex",
      permissions: { read: [], write: [], approval_required: true },
      completion_callback: { type: "mcp_tool", tool: "queueproof_report_execution_result" },
    };
    expect(executionPacketSchema.safeParse(packet).success).toBe(true);
    expect(executionPacketSchema.safeParse({ ...packet, evidence: [] }).success).toBe(false);
  });
  it("bounds query size and requires a database", () => {
    expect(queryRequestSchema.safeParse({ query: "", database: "" }).success).toBe(false);
  });
});
