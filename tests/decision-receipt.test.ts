import { describe, expect, it } from "vitest";
import {
  applyAssumption,
  canonicalJson,
  receiptHash,
  rescore,
  whyAboveNext,
} from "../lib/server/decision-receipt";
import type { RankingInput } from "../packages/contracts/src";

/** The policy declares every penalty key, so a fixture must supply all of them. */
function penalties(overrides: Partial<RankingInput["penalties"]> = {}): RankingInput["penalties"] {
  return {
    likelyResolved: 0,
    duplicate: 0,
    unresolvedDependency: 0,
    weakEvidence: 0,
    conflictingEvidence: 0,
    staleEvidence: 0,
    missingOwner: 0,
    lowActionability: 0,
    ...overrides,
  };
}

function input(overrides: Partial<RankingInput> = {}): RankingInput {
  return {
    id: "task-a",
    title: "Restore authentication for the enterprise tenant",
    status: "open",
    businessImpact: 18,
    urgency: 14,
    dependencyUnlock: 12,
    customerRevenue: 9,
    incidentSecurity: 8,
    commitmentStrength: 6,
    authorityReliability: 4,
    evidenceFreshness: 3,
    quickWinLeverage: 2,
    confidence: 0.75,
    penalties: penalties(),
    ...overrides,
  } as RankingInput;
}

describe("canonical hashing (web/API/MCP parity)", () => {
  it("hashes structurally identical receipts identically regardless of key order", async () => {
    // This is the whole basis of the parity claim: two code paths assembling the same
    // receipt in different orders must produce the same hash.
    const a = { receipt_id: "r1", task: { title: "Ship", score: 80 }, evidence: ["s1", "s2"] };
    const b = { evidence: ["s1", "s2"], task: { score: 80, title: "Ship" }, receipt_id: "r1" };
    expect(await receiptHash(a)).toBe(await receiptHash(b));
  });

  it("changes the hash when any material value changes", async () => {
    const base = { receipt_id: "r1", task: { title: "Ship", score: 80 } };
    const altered = { receipt_id: "r1", task: { title: "Ship", score: 81 } };
    expect(await receiptHash(base)).not.toBe(await receiptHash(altered));
  });

  it("excludes the hash field so a receipt can carry its own hash", async () => {
    const receipt = { receipt_id: "r1", task: { title: "Ship" } };
    const hash = await receiptHash(receipt);
    expect(await receiptHash({ ...receipt, receipt_hash: hash })).toBe(hash);
  });

  it("preserves array order, which is meaningful for ranked evidence", () => {
    expect(canonicalJson({ e: ["b", "a"] })).not.toBe(canonicalJson({ e: ["a", "b"] }));
  });

  it("treats an explicitly undefined field as absent", () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe(canonicalJson({ a: 1 }));
  });
});

describe("why above #2", () => {
  it("explains the gap purely from score component deltas", () => {
    const leader = input({ id: "task-a", customerRevenue: 12, dependencyUnlock: 16 });
    const runnerUp = input({ id: "task-b", customerRevenue: 2, dependencyUnlock: 5 });

    const result = whyAboveNext(leader, runnerUp);

    expect(result.leaderId).toBe("task-a");
    expect(result.runnerUpId).toBe("task-b");
    expect(result.scoreDelta).toBeGreaterThan(0);

    // The stated deltas must sum to the score gap: the explanation has to actually
    // account for the difference, not merely gesture at it.
    const summed = result.components.reduce((total, entry) => total + entry.delta, 0);
    expect(Math.round(summed * 100) / 100).toBe(result.scoreDelta);

    // Ordered by magnitude, so the dominant reason is first.
    const magnitudes = result.components.map((entry) => Math.abs(entry.delta));
    expect([...magnitudes].sort((a, b) => b - a)).toEqual(magnitudes);
    expect(result.components[0].label).toMatch(/people unblocked|customer or revenue/);
  });

  it("reports no decisive component when two items score identically", () => {
    const result = whyAboveNext(input({ id: "task-a" }), input({ id: "task-b" }));
    expect(result.scoreDelta).toBe(0);
    expect(result.components).toEqual([]);
    expect(result.summary).toMatch(/identically/);
  });
});

describe("counterfactual", () => {
  it("changes only the named assumption and reports the resulting delta", () => {
    const base = input({ urgency: 4 });
    const outcome = applyAssumption(base, { kind: "deadline_urgency", value: 18 });

    expect(outcome.after.finalScore).toBeGreaterThan(outcome.before.finalScore);
    expect(outcome.delta).toBe(
      Math.round((outcome.after.finalScore - outcome.before.finalScore) * 100) / 100,
    );
    // Every other component must be untouched, or the counterfactual would misattribute.
    for (const key of Object.keys(outcome.before.componentScores)) {
      if (key === "urgency") continue;
      expect(outcome.after.componentScores[key]).toBe(outcome.before.componentScores[key]);
    }
  });

  it("does not mutate the stored input", () => {
    const base = input({ urgency: 4 });
    const snapshot = JSON.stringify(base);
    applyAssumption(base, { kind: "deadline_urgency", value: 18 });
    expect(JSON.stringify(base)).toBe(snapshot);
  });

  it("clears the blocked penalty when the blocker is resolved", () => {
    const blocked = input({ status: "blocked", penalties: penalties({ unresolvedDependency: 18 }) });
    const outcome = applyAssumption(blocked, { kind: "blocker_resolved" });
    expect(outcome.after.penalties.unresolvedDependency).toBe(0);
    expect(outcome.after.finalScore).toBeGreaterThan(outcome.before.finalScore);
  });

  it("drops a completed item's score to zero, upholding the ranking invariant", () => {
    const outcome = applyAssumption(input(), { kind: "status", value: "completed" });
    expect(outcome.after.finalScore).toBe(0);
  });

  it("clamps an out-of-range assumption to the policy maximum", () => {
    const outcome = applyAssumption(input(), { kind: "deadline_urgency", value: 9999 });
    expect(outcome.after.componentScores.urgency).toBe(18);
  });
});

describe("determinism", () => {
  it("produces an identical score for an identical stored input", () => {
    const stored = input();
    expect(rescore(stored)).toEqual(rescore(JSON.parse(JSON.stringify(stored))));
  });
});
