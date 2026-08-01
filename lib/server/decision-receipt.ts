import { compare, counterfactual, rank } from "../../packages/ranking/src";
import type { RankingInput } from "../../packages/contracts/src";
import { sha256 } from "../../packages/security/src";

/**
 * Decision Receipt support: canonical hashing, "why above #2", and counterfactuals.
 *
 * The hash is what makes web, API, MCP and CLI verifiably the same answer. It must be
 * computed over a canonical form, because JSON.stringify preserves insertion order and
 * two structurally identical receipts assembled by different code paths would otherwise
 * hash differently and the parity claim would be meaningless.
 *
 * What the hash proves: this receipt's content is byte-identical wherever it is read.
 * What it does NOT prove: that the underlying provider data has not changed since. That
 * distinction is deliberate — an integrity claim that overreaches is worse than none.
 */

/** Recursively sort object keys so structurally equal values serialise identically. */
export function canonicalise(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalise);
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    return Object.keys(source)
      .sort()
      .reduce<Record<string, unknown>>((accumulator, key) => {
        // Undefined is dropped rather than serialised, matching JSON semantics, so an
        // explicitly-absent field and a missing field hash the same.
        if (source[key] !== undefined) accumulator[key] = canonicalise(source[key]);
        return accumulator;
      }, {});
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalise(value));
}

/**
 * Stable content hash for a receipt. The hash field itself is excluded, so a receipt can
 * carry its own hash without the value depending on itself.
 */
export async function receiptHash(receipt: Record<string, unknown>): Promise<string> {
  const rest = Object.fromEntries(
    Object.entries(receipt).filter(([key]) => key !== "receipt_hash"),
  );
  return sha256(canonicalJson(rest));
}

export type ComponentDelta = {
  component: string;
  delta: number;
  /** Human-readable, generated from the numbers — never from model prose. */
  label: string;
};

export type WhyAboveNext = {
  leaderId: string;
  runnerUpId: string;
  scoreDelta: number;
  components: ComponentDelta[];
  summary: string;
};

const COMPONENT_LABELS: Record<string, string> = {
  businessImpact: "business impact",
  urgency: "deadline urgency",
  dependencyUnlock: "people unblocked",
  customerRevenue: "customer or revenue consequence",
  incidentSecurity: "security or incident severity",
  commitmentStrength: "explicit commitment strength",
  authorityReliability: "source authority",
  evidenceFreshness: "evidence freshness",
  quickWinLeverage: "quick-win leverage",
};

/**
 * Explain a ranking gap strictly from score components.
 *
 * Every line is arithmetic on the deterministic policy output. Nothing here is generated
 * by a language model, which is the point: the explanation is reproducible and can be
 * checked against the stored inputs.
 */
export function whyAboveNext(leader: RankingInput, runnerUp: RankingInput): WhyAboveNext {
  const comparison = compare(leader, runnerUp);
  const components = comparison.decisiveComponents.map((entry) => ({
    component: entry.key,
    delta: Math.round(entry.delta * 100) / 100,
    label: `${entry.delta > 0 ? "+" : ""}${Math.round(entry.delta * 100) / 100} ${
      COMPONENT_LABELS[entry.key] ?? entry.key
    }`,
  }));

  return {
    leaderId: comparison.first.id,
    runnerUpId: comparison.second.id,
    scoreDelta: comparison.delta,
    components,
    summary:
      comparison.delta === 0
        ? "Both items score identically under this policy; the tie is broken by identifier."
        : `Leads by ${Math.abs(comparison.delta)} points.`,
  };
}

export type CounterfactualAssumption =
  | { kind: "deadline_urgency"; value: number }
  | { kind: "customer_revenue"; value: number }
  | { kind: "dependency_unlock"; value: number }
  | { kind: "blocker_resolved" }
  | { kind: "status"; value: RankingInput["status"] };

/**
 * Translate a user-facing assumption into a policy input patch, then re-score.
 *
 * Only the named field changes: the rest of the input is carried through untouched, so a
 * counterfactual cannot quietly move several dials at once and misattribute the result.
 * Production evidence is never mutated — this operates on a copy of the stored input.
 */
export function applyAssumption(input: RankingInput, assumption: CounterfactualAssumption) {
  const patch: Partial<RankingInput> = {};
  switch (assumption.kind) {
    case "deadline_urgency":
      patch.urgency = clampComponent(assumption.value, 18);
      break;
    case "customer_revenue":
      patch.customerRevenue = clampComponent(assumption.value, 12);
      break;
    case "dependency_unlock":
      patch.dependencyUnlock = clampComponent(assumption.value, 16);
      break;
    case "blocker_resolved":
      // Removing the blocker clears the blocked penalty and reopens the item.
      patch.status = "open";
      patch.penalties = { ...input.penalties, unresolvedDependency: 0 };
      break;
    case "status":
      patch.status = assumption.value;
      break;
  }

  const outcome = counterfactual(input, patch);
  return {
    assumption,
    patch,
    before: outcome.before,
    after: outcome.after,
    delta: Math.round(outcome.delta * 100) / 100,
    changed: outcome.delta !== 0,
  };
}

function clampComponent(value: number, max: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(0, Math.round(value * 100) / 100));
}

/** Re-score a stored input unchanged. Used to prove determinism across time. */
export function rescore(input: RankingInput) {
  return rank(input);
}
