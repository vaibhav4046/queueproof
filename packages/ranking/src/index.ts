import type { RankingInput } from "../../contracts/src";

export const DEFAULT_POLICY_VERSION = "queueproof-default-2.0.0";

export type RankingPolicy = {
  version: string;
  weights: {
    urgencyDeadline: number;
    customerOperationalImpact: number;
    explicitCommitment: number;
    dependencyBlocking: number;
    sourceCorroboration: number;
    recency: number;
  };
};

export const DEFAULT_POLICY: RankingPolicy = Object.freeze({
  version: DEFAULT_POLICY_VERSION,
  weights: Object.freeze({
    urgencyDeadline: 25,
    customerOperationalImpact: 25,
    explicitCommitment: 15,
    dependencyBlocking: 15,
    sourceCorroboration: 10,
    recency: 10,
  }),
});

export const ACTIVE_FORMULA =
  "25% urgency/deadline + 25% customer/operational impact + 15% explicit commitment + 15% dependency/blocking + 10% source corroboration + 10% recency − evidence penalties";

export type RankingResult = {
  id: string;
  policyVersion: string;
  componentScores: Record<string, number>;
  penalties: Record<string, number>;
  finalScore: number;
  confidence: number;
  priorityBand: "critical" | "high" | "normal" | "low";
  explanation: string[];
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function rank(input: RankingInput, policy: RankingPolicy = DEFAULT_POLICY): RankingResult {
  const totalWeight = Object.values(policy.weights).reduce((sum, value) => sum + value, 0);
  if (Math.abs(totalWeight - 100) > 0.001) throw new Error("Ranking policy weights must sum to 100.");
  const componentScores = {
    urgencyDeadline: (input.urgency / 18) * policy.weights.urgencyDeadline,
    customerOperationalImpact:
      Math.max(input.businessImpact / 20, input.customerRevenue / 12, input.incidentSecurity / 10) *
      policy.weights.customerOperationalImpact,
    explicitCommitment: (input.commitmentStrength / 8) * policy.weights.explicitCommitment,
    dependencyBlocking: (input.dependencyUnlock / 16) * policy.weights.dependencyBlocking,
    sourceCorroboration: (input.authorityReliability / 6) * policy.weights.sourceCorroboration,
    recency: (input.evidenceFreshness / 4) * policy.weights.recency,
  };
  const penalties = { ...input.penalties };
  const positive = Object.values(componentScores).reduce((sum, value) => sum + value, 0);
  const negative = Object.values(penalties).reduce((sum, value) => sum + value, 0);
  const statusPenalty =
    input.status === "completed" || input.status === "cancelled" ? 100 : 0;
  const finalScore = clamp(Math.round((positive - negative - statusPenalty) * 100) / 100, 0, 100);
  const priorityBand =
    finalScore >= 80 ? "critical" : finalScore >= 60 ? "high" : finalScore >= 35 ? "normal" : "low";

  return {
    id: input.id,
    policyVersion: policy.version,
    componentScores,
    penalties,
    finalScore,
    confidence: input.confidence,
    priorityBand,
    explanation: [
      `Positive components total ${positive.toFixed(1)}.`,
      negative > 0 ? `Evidence and execution penalties total ${negative.toFixed(1)}.` : "No ranking penalties applied.",
      statusPenalty ? "Confirmed completed or cancelled work is not actionable." : "Item remains actionable.",
    ],
  };
}

export function compare(a: RankingInput, b: RankingInput) {
  const rankedA = rank(a);
  const rankedB = rank(b);
  return {
    first: rankedA,
    second: rankedB,
    delta: Math.round((rankedA.finalScore - rankedB.finalScore) * 100) / 100,
    decisiveComponents: Object.keys(rankedA.componentScores)
      .map((key) => ({
        key,
        delta:
          rankedA.componentScores[key] -
          rankedB.componentScores[key],
      }))
      .filter((entry) => entry.delta !== 0)
      .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta)),
  };
}

export function counterfactual(input: RankingInput, patch: Partial<RankingInput>) {
  const before = rank(input);
  const after = rank({ ...input, ...patch });
  return { before, after, delta: after.finalScore - before.finalScore };
}

