import { describe, expect, it } from "vitest";
import { compare, counterfactual, rank } from "../packages/ranking/src";
import type { RankingInput } from "../packages/contracts/src";

const evidence = [{
  sourceId: "src-1",
  provider: "linear",
  externalId: "LIN-42",
  title: "Release blocker",
  excerpt: "Customer rollout is blocked.",
  timestamp: "2026-07-31T09:00:00.000Z",
  ingestionTimestamp: "2026-07-31T09:01:00.000Z",
  url: "https://example.com/LIN-42",
  authority: "primary" as const,
  metadata: {},
}];

const base: RankingInput = {
  id: "work-1", title: "Unblock customer rollout", status: "open",
  businessImpact: 18, urgency: 16, dependencyUnlock: 14, customerRevenue: 10,
  incidentSecurity: 0, commitmentStrength: 6, authorityReliability: 5,
  evidenceFreshness: 4, quickWinLeverage: 4,
  penalties: { likelyResolved: 0, duplicate: 0, unresolvedDependency: 0, weakEvidence: 0,
    conflictingEvidence: 0, staleEvidence: 0, missingOwner: 0, lowActionability: 0 },
  confidence: 0.91, evidence,
};

describe("deterministic ranking", () => {
  it("is deterministic and bounded", () => {
    expect(rank(base)).toEqual(rank(structuredClone(base)));
    expect(rank(base).finalScore).toBe(87.43);
    expect(rank(base).priorityBand).toBe("critical");
  });
  it("removes completed and cancelled work from actionability", () => {
    expect(rank({ ...base, status: "completed" }).finalScore).toBe(0);
    expect(rank({ ...base, status: "cancelled" }).finalScore).toBe(0);
  });
  it("applies penalties without producing a negative score", () => {
    const result = rank({ ...base, penalties: { ...base.penalties, likelyResolved: 40, duplicate: 30, staleEvidence: 12, weakEvidence: 12 } });
    expect(result.finalScore).toBe(0);
  });
  it("explains comparisons and counterfactuals", () => {
    const weaker = { ...base, id: "work-2", urgency: 4 };
    expect(compare(base, weaker).delta).toBe(16.67);
    expect(counterfactual(base, { urgency: 18 }).delta).toBeCloseTo(2.78, 8);
  });
});
