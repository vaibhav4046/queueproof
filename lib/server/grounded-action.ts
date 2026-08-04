import type { GroundedPriorityItem } from "../../packages/contracts/src";
import { rank } from "../../packages/ranking/src";

type ActionEvidence = {
  id: string;
  sourceId: string;
  provider: string;
  title: string;
  excerpt: string;
  timestamp: string | null;
  url: string | null;
};

type ActionContradiction = {
  summary: string;
  providers: string[];
  evidenceIds: string[];
};

const exactIdentifiers = (text: string) =>
  [...new Set(text.match(/\b[A-Z][A-Z0-9]+-\d+\b/g) ?? [])];

const freshnessScore = (timestamps: Array<string | null>, nowMs: number) => {
  const ages = timestamps
    .map((value) => value ? Date.parse(value) : Number.NaN)
    .filter(Number.isFinite)
    .map((value) => Math.max(0, nowMs - value));
  if (!ages.length) return 2;
  const newest = Math.min(...ages);
  if (newest <= 7 * 24 * 60 * 60 * 1_000) return 4;
  if (newest <= 30 * 24 * 60 * 60 * 1_000) return 3;
  return 1;
};

/**
 * Compile a safe proposal directly from a returned contradiction when no
 * persisted queue item shares the query's exact evidence lineage. The score is
 * still produced by QueueProof's public deterministic ranking formula, and the
 * proposal never performs a provider write.
 */
export function compileContradictionAction(input: {
  queryId: string;
  evidence: ActionEvidence[];
  contradictions: ActionContradiction[];
  now?: Date;
}): GroundedPriorityItem | null {
  const contradiction = input.contradictions[0];
  if (!contradiction) return null;
  const evidenceById = new Map(input.evidence.map((item) => [item.id, item]));
  const linkedEvidence = contradiction.evidenceIds
    .map((id) => evidenceById.get(id))
    .filter((item): item is ActionEvidence => Boolean(item));
  if (!linkedEvidence.length) return null;

  const corpus = `${contradiction.summary} ${linkedEvidence.map((item) => `${item.title} ${item.excerpt}`).join(" ")}`;
  const identifiers = exactIdentifiers(corpus);
  const entity = identifiers[0] ?? linkedEvidence[0]!.title;
  const providers = [...new Set(linkedEvidence.map((item) => item.provider))];
  const sourceCount = new Set(linkedEvidence.map((item) => item.sourceId)).size;
  const nowMs = (input.now ?? new Date()).getTime();
  const hasIncidentImpact = /\b(auth(?:entication)?|security|incident|outage|sev[ -]?[01])\b/i.test(corpus);
  const hasCustomerImpact = /\b(customer|client|enterprise|renewal|revenue|contract|churn|locked out)\b/i.test(corpus);
  const hasUrgency = /\b(today|urgent|asap|immediately|deadline|overdue|before (?:monday|tuesday|wednesday|thursday|friday)|\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December))\b/i.test(corpus);
  const hasCommitment = /\b(i will|we will|promise\w*|commit\w*|hard customer commitment)\b/i.test(corpus);
  const confidenceSignals = [
    identifiers.length > 0,
    linkedEvidence.some((item) => Boolean(item.timestamp)),
    providers.length > 1,
    sourceCount > 1,
  ];
  const confidence = confidenceSignals.filter(Boolean).length / confidenceSignals.length;
  const ranking = rank({
    id: `action:${input.queryId}:contradiction:1`,
    title: `Resolve the ${entity} tracked-state mismatch`,
    status: "open",
    businessImpact: hasIncidentImpact || hasCustomerImpact ? 18 : 9,
    urgency: hasUrgency ? 17 : 10,
    dependencyUnlock: 8,
    customerRevenue: hasCustomerImpact ? 11 : 2,
    incidentSecurity: hasIncidentImpact ? 10 : 0,
    commitmentStrength: hasCommitment ? 8 : 4,
    authorityReliability: Math.min(6, 2 + providers.length * 2),
    evidenceFreshness: freshnessScore(linkedEvidence.map((item) => item.timestamp), nowMs),
    quickWinLeverage: 5,
    penalties: {
      likelyResolved: 0,
      duplicate: 0,
      unresolvedDependency: 0,
      weakEvidence: providers.length === 1 ? 6 : 0,
      conflictingEvidence: 5,
      staleEvidence: 0,
      missingOwner: 6,
      lowActionability: 0,
    },
    confidence,
    evidence: linkedEvidence.map((item) => ({
      sourceId: item.sourceId,
      provider: item.provider,
      externalId: identifiers[0] ?? item.sourceId,
      title: item.title,
      excerpt: item.excerpt,
      timestamp: item.timestamp,
      ingestionTimestamp: null,
      url: item.url,
      authority: "primary" as const,
      metadata: {},
    })),
  });

  return {
    id: ranking.id,
    title: `Resolve the ${entity} tracked-state mismatch`,
    normalized_entity: entity,
    owner: null,
    due_date: null,
    status: "proposed",
    score: ranking.finalScore,
    score_breakdown: ranking.componentScores,
    penalties: ranking.penalties,
    why_now: [
      contradiction.summary,
      providers.length > 1
        ? `${providers.length} independent providers disagree on the current state.`
        : "One attributable receipt reports conflicting execution and tracking states; corroboration is still required.",
    ],
    recommended_next_safe_action: "Review the cited receipt, confirm the current tracked state, then route any provider update through QueueProof approval.",
    evidence_ids: linkedEvidence.map((item) => item.id),
    disagreements: [contradiction],
    confidence,
    provider_coverage: providers,
    deduplicated_tasks: [],
    approval_required: true,
  };
}
