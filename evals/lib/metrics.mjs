/**
 * Pure metric computation for the QueueProof evaluation suite.
 *
 * Nothing in this module talks to the network, the filesystem, or a clock. Every number it
 * returns is derived from the arguments it was given, so the same evaluations always produce
 * the same metrics. Anything that cannot be derived that way is not computed here and is
 * reported as "not measured" by the runner.
 */

/** The evaluation taxonomy every fixture case must fall into. */
export const EVAL_CATEGORIES = Object.freeze([
  "exact-id",
  "actor",
  "thread",
  "temporal",
  "metadata",
  "entity-dedup",
  "knowledge-update",
  "attribution",
  "multilingual",
  "multi-hop",
  "conflict",
  "priority",
  "counterfactual",
  "adversarial",
  "large-pdf",
]);

/** Providers a case is allowed to require. */
export const EVAL_PROVIDERS = Object.freeze(["slack", "gmail", "linear", "document"]);

/**
 * Metrics that a live connector run measures and a fixture run cannot. Kept here so the
 * runner, the JSON result and the markdown report cannot drift apart about what was skipped.
 */
export const NOT_MEASURED_WITHOUT_LIVE = Object.freeze([
  {
    metric: "Citation precision",
    reason: "Requires answers grounded in real indexed sources plus a human-labelled citation key.",
  },
  {
    metric: "Citation recall",
    reason: "Requires the full set of correct sources per question, which only exists once real data is indexed.",
  },
  {
    metric: "End to end latency",
    reason: "Requires a real /api/query round trip against a deployment with verified connectors.",
  },
  {
    metric: "HydraDB call count",
    reason: "Counted server side per query run; no query runs happen in fixture mode.",
  },
  {
    metric: "Cost per query",
    reason: "Derived from real provider and HydraDB usage; no billable call is made in fixture mode.",
  },
]);

const ratio = (correct, total) => (total === 0 ? null : Math.round((correct / total) * 10_000) / 10_000);

/**
 * @param {Array<{
 *   id: string,
 *   category: string,
 *   expectedMode: "fast" | "thinking",
 *   predictedMode: "fast" | "thinking",
 *   requiredProviders: string[],
 * }>} evaluations
 * @param {string[]} availableProviders providers proven usable for this run; empty in fixture mode
 */
export function computeMetrics(evaluations, availableProviders = []) {
  const available = new Set(availableProviders);

  const perCategory = {};
  const modeSplit = { predicted: { fast: 0, thinking: 0 }, expected: { fast: 0, thinking: 0 } };
  const escalation = { predictedThinking: 0, overEscalated: 0, underEscalated: 0 };
  const byProvider = {};
  let correct = 0;
  let casesWithUnavailableProviders = 0;

  for (const item of evaluations) {
    const hit = item.predictedMode === item.expectedMode;
    if (hit) correct += 1;

    const bucket = perCategory[item.category] ?? { total: 0, correct: 0, accuracy: null };
    bucket.total += 1;
    if (hit) bucket.correct += 1;
    bucket.accuracy = ratio(bucket.correct, bucket.total);
    perCategory[item.category] = bucket;

    modeSplit.predicted[item.predictedMode] += 1;
    modeSplit.expected[item.expectedMode] += 1;
    if (item.predictedMode === "thinking") escalation.predictedThinking += 1;
    if (item.predictedMode === "thinking" && item.expectedMode === "fast") escalation.overEscalated += 1;
    if (item.predictedMode === "fast" && item.expectedMode === "thinking") escalation.underEscalated += 1;

    const missing = item.requiredProviders.filter((provider) => !available.has(provider));
    if (missing.length > 0) casesWithUnavailableProviders += 1;
    for (const provider of missing) {
      byProvider[provider] = (byProvider[provider] ?? 0) + 1;
    }
  }

  return {
    totalCases: evaluations.length,
    router: { correct, total: evaluations.length, accuracy: ratio(correct, evaluations.length) },
    perCategory,
    modeSplit,
    escalation,
    providerCoverage: {
      availableProviders: [...available].sort(),
      casesWithUnavailableProviders,
      byProvider,
    },
  };
}

/** Render rows as RFC 4180 style CSV. Column order follows the first row's keys. */
export function toCsv(rows) {
  if (rows.length === 0) return "";
  const columns = Object.keys(rows[0]);
  const escape = (value) => {
    const text = Array.isArray(value) ? value.join(" ") : value === null || value === undefined ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return [columns.join(","), ...rows.map((row) => columns.map((column) => escape(row[column])).join(","))].join("\n");
}
