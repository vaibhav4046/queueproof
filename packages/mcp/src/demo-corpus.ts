/**
 * The synthetic Helios Robotics corpus that backs QueueProof's unauthenticated demo.
 *
 * The demo surface must never reach into a tenant's real connectors. A single mis-aimed
 * `QUEUEPROOF_PUBLIC_WORKSPACE_ID` is enough to publish somebody's inbox to anonymous
 * visitors, and no amount of downstream filtering makes that safe. Shipping the demo
 * corpus in the repository removes the possibility structurally: there is no tenant to
 * mis-aim at, the records are fabricated, and the answers are identical on every deploy.
 *
 * Retrieval here is deliberately lexical rather than a second embedding stack. The demo's
 * job is to show the plan -> evidence -> grounded-answer -> contradiction pipeline, and
 * that pipeline is shared verbatim with the authenticated HydraDB path.
 */

export type DemoRecord = {
  sourceId: string;
  provider: "slack" | "linear" | "github" | "gmail" | "document";
  title: string;
  excerpt: string;
  timestamp: string;
  url: string | null;
};

/**
 * Helios Robotics: a fabricated hardware company shipping the Atlas gripper, the Nimbus
 * telemetry service, and the Vega pricing tier. Contradictions between sources are
 * intentional — they are the point of a cross-source evidence tool.
 */
export const DEMO_CORPUS: readonly DemoRecord[] = [
  {
    sourceId: "linear:ATL-204",
    provider: "linear",
    title: "ATL-204 — Atlas firmware 4.2 rollout to fleet",
    excerpt:
      "ATL-204 Atlas firmware 4.2 rollout. Owner Priya Raman. Status In Progress. Target ship date 28 March 2026, moved from 14 March after the gripper calibration regression in BUG-123 blocked the release candidate. Rollout is staged: Madrid depot first, then Rotterdam, then the full fleet. Blocked by BUG-123.",
    timestamp: "2026-03-02T09:14:00Z",
    url: "https://linear.app/helios/issue/ATL-204",
  },
  {
    sourceId: "linear:BUG-123",
    provider: "linear",
    title: "BUG-123 — Gripper calibration regression on Atlas 4.2-rc3",
    excerpt:
      "BUG-123 gripper calibration regression. Owner Yuki Tanaka. Severity S1. Atlas 4.2-rc3 mis-seats the calibration offset when the gripper is cold-started below 8C, producing a 3.4mm placement error. Reproduced 11 of 12 times at the Madrid depot. Blocks ATL-204.",
    timestamp: "2026-02-27T16:41:00Z",
    url: "https://linear.app/helios/issue/BUG-123",
  },
  {
    sourceId: "linear:SEC-309",
    provider: "linear",
    title: "SEC-309 — Rotate depot integration credentials",
    excerpt:
      "SEC-309 credential rotation for depot integrations. Owner Marcus Ohene. Every depot integration credential is rotated on a 90 day cycle; the current cycle closes 31 March 2026. Rotation must complete before the Atlas firmware rollout reaches Rotterdam because the rollout re-authenticates each depot agent.",
    timestamp: "2026-03-04T11:02:00Z",
    url: "https://linear.app/helios/issue/SEC-309",
  },
  {
    sourceId: "linear:NIM-17",
    provider: "linear",
    title: "NIM-17 — Nimbus telemetry service outage postmortem",
    excerpt:
      "NIM-17 Nimbus telemetry outage. Owner Tom Bergstrom. Nimbus dropped telemetry for 74 minutes on 19 February 2026 after the migration to the new ingest cluster exhausted its connection pool. Customer impact: Northwind Logistics lost depot visibility during a delayed shipment window.",
    timestamp: "2026-02-20T08:30:00Z",
    url: "https://linear.app/helios/issue/NIM-17",
  },
  {
    sourceId: "linear:NIM-22",
    provider: "linear",
    title: "NIM-22 — Nimbus migration connection pool sizing",
    excerpt:
      "NIM-22 follow-up to NIM-17. Owner Tom Bergstrom. Raise the Nimbus ingest connection pool from 64 to 256 and add a saturation alert at 70 percent. Nimbus migration is not considered complete until NIM-22 ships. Target 20 March 2026.",
    timestamp: "2026-02-21T13:55:00Z",
    url: "https://linear.app/helios/issue/NIM-22",
  },
  {
    sourceId: "slack:C04ATLAS/1709301240",
    provider: "slack",
    title: "#atlas-firmware — Priya Raman on the ship date",
    excerpt:
      "Priya Raman in #atlas-firmware: confirming the Atlas firmware ship date is 14 March. Madrid depot is the pilot and they are ready. I will post the rollout runbook tomorrow.",
    timestamp: "2026-03-01T10:34:00Z",
    url: "https://helios.slack.com/archives/C04ATLAS/p1709301240",
  },
  {
    sourceId: "slack:C04ATLAS/1709560800",
    provider: "slack",
    title: "#atlas-firmware — ship date moved after BUG-123",
    excerpt:
      "Yuki Tanaka in #atlas-firmware: BUG-123 is worse than we thought, the cold-start path is wrong not just mis-tuned. Priya Raman: understood, moving the Atlas ship date to 28 March. Nobody ships 4.2 to Madrid until BUG-123 is verified fixed.",
    timestamp: "2026-03-04T14:40:00Z",
    url: "https://helios.slack.com/archives/C04ATLAS/p1709560800",
  },
  {
    sourceId: "slack:C04ATLAS/1709647200",
    provider: "slack",
    title: "#atlas-firmware — Madrid depot readiness",
    excerpt:
      "Sofia Ramirez in #atlas-firmware: Madrid depot has 42 Atlas units on 4.1.7 and the cold storage bay runs at 4C overnight, which is exactly the BUG-123 trigger range. Recommend we do not pilot in Madrid until the calibration fix lands.",
    timestamp: "2026-03-05T14:40:00Z",
    url: "https://helios.slack.com/archives/C04ATLAS/p1709647200",
  },
  {
    sourceId: "slack:C04SEC/1709733600",
    provider: "slack",
    title: "#security — credential rotation window",
    excerpt:
      "Marcus Ohene in #security: SEC-309 credential rotation starts 24 March and takes roughly four days across all depots. That lands before the 28 March Atlas rollout with almost no slack. If the firmware date moves earlier again we have a collision.",
    timestamp: "2026-03-06T14:40:00Z",
    url: "https://helios.slack.com/archives/C04SEC/p1709733600",
  },
  {
    sourceId: "slack:C04NIMBUS/1708344600",
    provider: "slack",
    title: "#nimbus — outage timeline",
    excerpt:
      "Tom Bergstrom in #nimbus: Nimbus outage ran 09:12 to 10:26 UTC on 19 February, 74 minutes. Root cause is the ingest connection pool, tracked in NIM-17. Northwind Logistics was the only customer with a delayed shipment inside the window.",
    timestamp: "2026-02-19T11:30:00Z",
    url: "https://helios.slack.com/archives/C04NIMBUS/p1708344600",
  },
  {
    sourceId: "slack:C04VEGA/1709906400",
    provider: "slack",
    title: "#vega-launch — pricing tier sign-off",
    excerpt:
      "Sofia Ramirez in #vega-launch: Vega pricing tier is signed off at 2400 EUR per depot per month with the telemetry add-on included. Vega launch checklist is at 9 of 12 items. Remaining: legal review of the Kestrel Components master services agreement, the Helios Robotics safety certification packet, and the Nimbus migration sign-off.",
    timestamp: "2026-03-08T14:40:00Z",
    url: "https://helios.slack.com/archives/C04VEGA/p1709906400",
  },
  {
    sourceId: "slack:C04VEGA/1710079200",
    provider: "slack",
    title: "#vega-launch — dependency on Nimbus",
    excerpt:
      "Tom Bergstrom in #vega-launch: Vega launch depends on the Nimbus migration because the pricing tier bundles telemetry. NIM-22 is the last migration item and it targets 20 March. If NIM-22 slips, the Vega launch checklist cannot close.",
    timestamp: "2026-03-10T14:40:00Z",
    url: "https://helios.slack.com/archives/C04VEGA/p1710079200",
  },
  {
    sourceId: "github:helios/atlas-firmware#812",
    provider: "github",
    title: "PR #812 — Fix cold-start calibration offset (BUG-123)",
    excerpt:
      "helios/atlas-firmware PR #812 by Yuki Tanaka. Fixes BUG-123 by reading the calibration offset after the thermal settle step instead of before it. Adds a regression test at 4C. Reviewed by Priya Raman. Merged 12 March 2026 into release/4.2.",
    timestamp: "2026-03-12T09:20:00Z",
    url: "https://github.com/helios/atlas-firmware/pull/812",
  },
  {
    sourceId: "github:helios/atlas-firmware#818",
    provider: "github",
    title: "PR #818 — Stage rollout by depot temperature band",
    excerpt:
      "helios/atlas-firmware PR #818 by Sofia Ramirez. Adds a rollout gate so depots with recorded ambient below 8C receive Atlas firmware 4.2 only after the calibration regression suite passes twice. Referenced by ATL-204. Open, awaiting review.",
    timestamp: "2026-03-13T15:05:00Z",
    url: "https://github.com/helios/atlas-firmware/pull/818",
  },
  {
    sourceId: "github:helios/nimbus#341",
    provider: "github",
    title: "PR #341 — Raise ingest connection pool to 256 (NIM-22)",
    excerpt:
      "helios/nimbus PR #341 by Tom Bergstrom. Implements NIM-22: ingest connection pool 64 to 256, saturation alert at 70 percent. Load test sustained 3.1x the 19 February peak with no queueing. Merged 18 March 2026.",
    timestamp: "2026-03-18T10:47:00Z",
    url: "https://github.com/helios/nimbus/pull/341",
  },
  {
    sourceId: "gmail:northwind-service-credit",
    provider: "gmail",
    title: "Northwind Logistics — service credit for 19 Feb delayed shipment",
    excerpt:
      "From Northwind Logistics operations to Helios Robotics account team: the 19 February telemetry loss coincided with a delayed shipment out of Rotterdam. Per the master services agreement we are claiming a Northwind Logistics service credit of 4 percent of the February invoice. Please confirm by 15 March.",
    timestamp: "2026-02-26T17:12:00Z",
    url: null,
  },
  {
    sourceId: "gmail:kestrel-msa-redlines",
    provider: "gmail",
    title: "Kestrel Components — MSA redlines returned",
    excerpt:
      "Kestrel Components legal returned redlines on the master services agreement. Two open points: liability cap on telemetry availability, and whether the Vega pricing tier is fixed for 24 months. Kestrel wants a decision before the Vega launch. Helios legal owner is Marcus Ohene.",
    timestamp: "2026-03-09T08:55:00Z",
    url: null,
  },
  {
    sourceId: "gmail:safety-cert-schedule",
    provider: "gmail",
    title: "Helios Robotics safety certification — audit scheduled",
    excerpt:
      "The notified body confirmed the Helios Robotics safety certification audit for 24 March 2026. The audit covers the Atlas gripper placement tolerance. Any firmware shipped after the audit date requires a delta submission, which adds roughly three weeks.",
    timestamp: "2026-03-07T12:30:00Z",
    url: null,
  },
  {
    sourceId: "document:vega-launch-checklist",
    provider: "document",
    title: "Vega launch checklist (v7)",
    excerpt:
      "Vega launch checklist v7. 12 items, 9 complete. Open: (10) Kestrel Components master services agreement signed, owner Marcus Ohene. (11) Helios Robotics safety certification issued, owner Sofia Ramirez. (12) Nimbus migration signed off, owner Tom Bergstrom. Launch is gated on all three.",
    timestamp: "2026-03-10T07:00:00Z",
    url: null,
  },
  {
    sourceId: "document:atlas-rollout-runbook",
    provider: "document",
    title: "Atlas firmware rollout runbook",
    excerpt:
      "Atlas firmware rollout runbook. Preconditions: BUG-123 verified fixed, SEC-309 credential rotation complete for the target depot, depot ambient temperature logged for 72 hours. Order: Madrid, Rotterdam, remaining fleet. Owner Priya Raman. Rollback is a single firmware pin to 4.1.7.",
    timestamp: "2026-03-06T07:00:00Z",
    url: null,
  },
  {
    sourceId: "document:nimbus-migration-plan",
    provider: "document",
    title: "Nimbus migration plan",
    excerpt:
      "Nimbus migration plan. Phase 1 ingest cluster cutover, complete 12 February 2026. Phase 2 connection pool sizing, tracked as NIM-22, target 20 March 2026. Phase 3 decommission the legacy ingest path, target 10 April 2026. The migration is not complete until phase 3.",
    timestamp: "2026-02-10T07:00:00Z",
    url: null,
  },
  {
    sourceId: "document:incident-review-2026-02",
    provider: "document",
    title: "February 2026 incident review",
    excerpt:
      "February 2026 incident review. One S1: the Nimbus telemetry outage of 19 February, 74 minutes, tracked as NIM-17. One S1 defect: the gripper calibration regression BUG-123, found 27 February before customer exposure. No customer data was affected in either case.",
    timestamp: "2026-03-01T07:00:00Z",
    url: null,
  },
];

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "did", "do", "does", "for",
  "from", "had", "has", "have", "how", "i", "in", "is", "it", "its", "me", "of", "on", "or",
  "our", "so", "than", "that", "the", "their", "them", "then", "there", "these", "they",
  "this", "to", "was", "we", "were", "what", "when", "where", "which", "who", "why", "will",
  "with", "you", "your",
]);

const tokenise = (value: string): string[] =>
  value
    .toLowerCase()
    .split(/[^a-z0-9#-]+/)
    .map((token) => token.replace(/^[#-]+|[#-]+$/g, ""))
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));

/** Document frequency over the fixed corpus, computed once at module load. */
const DOCUMENT_FREQUENCY = (() => {
  const frequency = new Map<string, number>();
  for (const record of DEMO_CORPUS) {
    for (const token of new Set(tokenise(`${record.title} ${record.excerpt}`))) {
      frequency.set(token, (frequency.get(token) ?? 0) + 1);
    }
  }
  return frequency;
})();

const NEWEST_TIMESTAMP = Math.max(
  ...DEMO_CORPUS.map((record) => Date.parse(record.timestamp)),
);
const RECENCY_SPAN_MS = 45 * 24 * 60 * 60 * 1000;

export type DemoRetrievalOptions = {
  /** Exact record identifier (ATL-204, BUG-123, PR numbers) when the plan found one. */
  exactIdentifier?: string | null;
  /** Providers the question named explicitly; those records are boosted, not filtered. */
  namedProviders?: readonly string[];
  /** Matches the retrieval planner's recency preference. */
  recencyBias?: number;
  maxResults?: number;
};

export type DemoRetrievalHit = DemoRecord & { relevanceScore: number };

/**
 * TF-IDF over the fixed corpus with an exact-identifier override.
 *
 * An exact identifier is a hard filter rather than a boost: asking for ATL-204 and getting
 * a confident answer about a different issue is the specific failure this tool exists to
 * prevent, and the same rule governs the authenticated path.
 */
export function searchDemoCorpus(
  query: string,
  options: DemoRetrievalOptions = {},
): DemoRetrievalHit[] {
  const identifier = options.exactIdentifier?.trim().toUpperCase() || null;
  const named = new Set((options.namedProviders ?? []).map((provider) => provider.toLowerCase()));
  const recencyBias = Math.min(Math.max(options.recencyBias ?? 0, 0), 1);
  const maxResults = options.maxResults ?? 12;

  const queryTokens = tokenise(query);
  if (!queryTokens.length && !identifier) return [];
  const queryCounts = new Map<string, number>();
  for (const token of queryTokens) queryCounts.set(token, (queryCounts.get(token) ?? 0) + 1);

  const pool = identifier
    ? DEMO_CORPUS.filter((record) =>
        `${record.sourceId} ${record.title} ${record.excerpt}`.toUpperCase().includes(identifier),
      )
    : DEMO_CORPUS;

  const scored = pool.map((record) => {
    const haystack = `${record.title} ${record.excerpt}`;
    const recordTokens = tokenise(haystack);
    const recordCounts = new Map<string, number>();
    for (const token of recordTokens) recordCounts.set(token, (recordCounts.get(token) ?? 0) + 1);

    let lexical = 0;
    for (const [token, queryCount] of queryCounts) {
      const recordCount = recordCounts.get(token);
      if (!recordCount) continue;
      const documentFrequency = DOCUMENT_FREQUENCY.get(token) ?? DEMO_CORPUS.length;
      const inverseFrequency = Math.log(1 + DEMO_CORPUS.length / documentFrequency);
      lexical += queryCount * Math.log(1 + recordCount) * inverseFrequency;
    }
    // Length normalisation keeps a long runbook from outranking a precise Slack line
    // purely by containing more words.
    lexical /= Math.log(2 + recordTokens.length);

    const ageMs = Math.max(0, NEWEST_TIMESTAMP - Date.parse(record.timestamp));
    const recency = Math.max(0, 1 - ageMs / RECENCY_SPAN_MS);
    const providerBoost = named.size && named.has(record.provider) ? 0.35 : 0;
    const identifierBoost = identifier ? 0.5 : 0;

    return {
      ...record,
      relevanceScore: lexical + recencyBias * 0.25 * recency + providerBoost + identifierBoost,
    };
  });

  const ranked = scored
    .filter((hit) => hit.relevanceScore > 0)
    .sort((left, right) =>
      right.relevanceScore - left.relevanceScore || left.sourceId.localeCompare(right.sourceId),
    )
    .slice(0, maxResults);

  // Normalise to the 0-1 band the HydraDB path reports so downstream consumers and the
  // published benchmark read the same scale on both surfaces.
  const top = ranked[0]?.relevanceScore ?? 1;
  return ranked.map((hit) => ({
    ...hit,
    relevanceScore: top > 0 ? Math.round((hit.relevanceScore / top) * 1000) / 1000 : 0,
  }));
}
