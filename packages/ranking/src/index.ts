import type { RankingInput } from "../../contracts/src";

export const DEFAULT_POLICY_VERSION = "queueproof-default-1.0.0";

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

export function rank(input: RankingInput): RankingResult {
  const componentScores = {
    businessImpact: input.businessImpact,
    urgency: input.urgency,
    dependencyUnlock: input.dependencyUnlock,
    customerRevenue: input.customerRevenue,
    incidentSecurity: input.incidentSecurity,
    commitmentStrength: input.commitmentStrength,
    authorityReliability: input.authorityReliability,
    evidenceFreshness: input.evidenceFreshness,
    quickWinLeverage: input.quickWinLeverage,
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
    policyVersion: DEFAULT_POLICY_VERSION,
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

