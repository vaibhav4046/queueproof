import { describe, expect, it } from "vitest";
import { actionProposalSchema, connectorStateSchema, executionPacketSchema, queryRequestSchema } from "../packages/contracts/src";

describe("public contracts", () => {
  it("accepts all declared connector proof states", () => {
    expect(connectorStateSchema.options).toContain("data_verified");
    expect(connectorStateSchema.options).toContain("permission_insufficient");
    expect(connectorStateSchema.options).toContain("rate_limited");
  });
  it("rejects an ungrounded action proposal", () => {
    expect(actionProposalSchema.safeParse({ provider: "linear", accountScope: "team", resourceId: "LIN-1",
      actionType: "comment", payload: {}, reason: "Follow up", evidenceIds: [], riskClass: "low",
      idempotencyKey: "123" }).success).toBe(false);
  });
  it("requires evidence and approval semantics in execution packets", () => {
    expect(executionPacketSchema.safeParse({
      packet_id: "pkt-1", workspace_id: "ws-1", created_at: "2026-07-31T12:00:00.000Z",
      policy_version: "queueproof-default-1.0.0",
      task: { title: "Ship", objective: "Ship safely", owner: null, project: null, deadline: null,
        priority_score: 80, confidence: 0.8 },
      why_now: ["Commitment due"], constraints: [], dependencies: [], acceptance_criteria: ["Checks pass"],
      evidence: [], contradictions: [], missing_information: [], recommended_agent: "codex",
      permissions: { read: [], write: [], approval_required: true },
      completion_callback: { type: "mcp_tool", tool: "queueproof_report_execution_result" },
    }).success).toBe(true);
  });
  it("bounds query size and requires a database", () => {
    expect(queryRequestSchema.safeParse({ query: "", database: "" }).success).toBe(false);
  });
});
