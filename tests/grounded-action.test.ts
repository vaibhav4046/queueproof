import { describe, expect, it } from "vitest";
import { compileContradictionAction } from "../lib/server/grounded-action";

const evidence = [{
  id: "github-state",
  sourceId: "github-issue-1",
  provider: "github",
  title: "AuthShield fix merged but ENG-456 still open",
  excerpt: "The Northwind authentication outage fix was merged. We committed to Friday 7 August 2026, but ENG-456 remains open.",
  timestamp: "2026-08-02T17:39:45.750Z",
  url: "https://github.com/example/repo/issues/1",
}];

describe("evidence-derived contradiction action", () => {
  it("uses the deterministic ranking formula and remains approval gated", () => {
    const action = compileContradictionAction({
      queryId: "query-1",
      evidence,
      contradictions: [{
        summary: "github receipt reports the code complete while ENG-456 remains open in its cited tracking state.",
        providers: ["github"],
        evidenceIds: ["github-state"],
      }],
      now: new Date("2026-08-04T00:00:00.000Z"),
    });

    expect(action).toMatchObject({
      id: "action:query-1:contradiction:1",
      normalized_entity: "ENG-456",
      status: "proposed",
      score: 70.78,
      confidence: 0.5,
      provider_coverage: ["github"],
      evidence_ids: ["github-state"],
      approval_required: true,
    });
    expect(action?.penalties).toMatchObject({
      weakEvidence: 6,
      conflictingEvidence: 5,
      missingOwner: 6,
    });
    expect(action?.why_now.join(" ")).toMatch(/corroboration is still required/i);
  });

  it("does not invent an action without a contradiction linked to returned evidence", () => {
    expect(compileContradictionAction({ queryId: "query-2", evidence, contradictions: [] })).toBeNull();
    expect(compileContradictionAction({
      queryId: "query-3",
      evidence,
      contradictions: [{ summary: "Conflict", providers: ["linear"], evidenceIds: ["missing"] }],
    })).toBeNull();
  });
});
