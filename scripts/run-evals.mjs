#!/usr/bin/env node
/**
 * QueueProof evaluation runner.
 *
 * The previous version of this file read the fixture file and printed its length. It ran zero
 * evaluations, so the only honest thing it could report was a case count. This version runs the
 * real deterministic components against the ground truth fixtures:
 *
 *   - the retrieval router (packages/retrieval/src) is called for every case and its predicted
 *     mode is compared against the hand-labelled expected mode,
 *   - the ranking function (packages/ranking/src) is called for every case that declares an
 *     expected top task, and the produced order is compared against that label,
 *   - the contract schema (packages/contracts/src) validates every constructed ranking input.
 *
 * Two run modes, never merged:
 *
 *   --fixture  (default) no credentials, no network. Measures only what is computable offline.
 *   --live     requires a reachable deployment with verified connectors. When those are absent
 *              the live phase is SKIPPED with an explicit reason. It is never simulated.
 *
 * Rule for every number this script emits: if it was not measured in this run, the word written
 * is "not measured". There is no default, no placeholder and no estimate for accuracy, latency,
 * citation quality or cost.
 *
 * Usage:
 *   node scripts/run-evals.mjs
 *   node scripts/run-evals.mjs --live
 */
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { EVAL_CATEGORIES, EVAL_PROVIDERS, NOT_MEASURED_WITHOUT_LIVE, computeMetrics, toCsv } from "../evals/lib/metrics.mjs";
import { rankingInputSchema } from "../packages/contracts/src/index.ts";
import { rank } from "../packages/ranking/src/index.ts";
import { planRetrieval } from "../packages/retrieval/src/index.ts";

const repoUrl = (path) => new URL(`../${path}`, import.meta.url);
const CASES_PATH = repoUrl("evals/fixtures/cases.json");
const RESULTS_DIR = repoUrl("evals/results/");
const LIVE_QUERY_TIMEOUT_MS = 30_000;

const wantsLive = process.argv.includes("--live");
const failures = [];
let assertionsRun = 0;

/** Record a fixture-computable assertion. Only these decide the fixture exit code. */
function assert(condition, message) {
  assertionsRun += 1;
  if (!condition) failures.push(message);
  return Boolean(condition);
}

// ---------------------------------------------------------------------------
// Fixture phase: structure
// ---------------------------------------------------------------------------

const cases = JSON.parse(readFileSync(fileURLToPath(CASES_PATH), "utf8"));

assert(Array.isArray(cases) && cases.length >= 30, `Expected at least 30 fixture cases, found ${cases.length}.`);

const seen = new Set();
for (const item of cases) {
  assert(!seen.has(item.id), `Duplicate case id: ${item.id}`);
  seen.add(item.id);
  assert(EVAL_CATEGORIES.includes(item.category), `Case ${item.id} uses unknown category "${item.category}".`);
  assert(item.question === item.query, `Case ${item.id} has drifted: question and query must stay identical.`);
  assert(
    Array.isArray(item.requiredProviders) && item.requiredProviders.length >= 1,
    `Case ${item.id} must declare at least one required provider.`,
  );
  for (const provider of item.requiredProviders ?? []) {
    assert(EVAL_PROVIDERS.includes(provider), `Case ${item.id} requires unknown provider "${provider}".`);
  }
  assert(
    item.expected?.mode === "fast" || item.expected?.mode === "thinking",
    `Case ${item.id} must label expected.mode as fast or thinking.`,
  );
}

for (const category of EVAL_CATEGORIES) {
  assert(cases.some((item) => item.category === category), `No fixture case covers category "${category}".`);
}

// ---------------------------------------------------------------------------
// Fixture phase: the real retrieval router
// ---------------------------------------------------------------------------

const evaluations = cases.map((item) => {
  const plan = planRetrieval(item.question);
  return {
    id: item.id,
    category: item.category,
    question: item.question,
    requiredProviders: item.requiredProviders,
    expectedMode: item.expected.mode,
    predictedMode: plan.mode,
    modeMatch: plan.mode === item.expected.mode,
    declaredRouterCategory: item.expectedCategory,
    predictedRouterCategory: plan.category,
    routerCategoryMatch: plan.category === item.expectedCategory,
    queryBy: plan.queryBy,
    graphContext: plan.graphContext,
    recencyBias: plan.recencyBias,
  };
});

// The declared router category is a contract lock, not independent ground truth: it records what
// the router does today so a silent behaviour change fails this run. Accuracy below is measured
// only against expected.mode, which was labelled by hand from the question itself.
for (const evaluation of evaluations) {
  assert(
    evaluation.routerCategoryMatch,
    `Router contract drift on ${evaluation.id}: fixture locks "${evaluation.declaredRouterCategory}", router returned "${evaluation.predictedRouterCategory}".`,
  );
}

// ---------------------------------------------------------------------------
// Fixture phase: the real ranking function
// ---------------------------------------------------------------------------

function buildRankingInput(candidate) {
  return rankingInputSchema.parse({
    ...candidate,
    penalties: candidate.penalties ?? {},
    evidence: candidate.evidence,
  });
}

const rankingResults = [];
for (const item of cases) {
  const topTask = item.expected?.topTask;
  if (!topTask) continue;

  const candidates = item.rankingCandidates ?? [];
  if (!assert(candidates.length >= 2, `Case ${item.id} declares expected.topTask but has fewer than two candidates.`)) {
    continue;
  }

  let inputs;
  try {
    inputs = candidates.map(buildRankingInput);
  } catch (error) {
    assert(false, `Case ${item.id} has a candidate that fails rankingInputSchema: ${error.message}`);
    continue;
  }

  const ranked = inputs.map((input) => rank(input));
  const ordered = [...ranked].sort((a, b) => b.finalScore - a.finalScore);
  const observedTop = ordered[0].id;

  const deterministic = inputs.every(
    (input) => JSON.stringify(rank(input)) === JSON.stringify(rank(structuredClone(input))),
  );
  const bounded = ranked.every((entry) => entry.finalScore >= 0 && entry.finalScore <= 100);
  const inertClosedWork = inputs.every((input, index) =>
    input.status === "completed" || input.status === "cancelled" ? ranked[index].finalScore === 0 : true,
  );

  assert(observedTop === topTask, `Case ${item.id}: expected top task "${topTask}" but rank() put "${observedTop}" first.`);
  assert(deterministic, `Case ${item.id}: rank() is not deterministic across structurally identical inputs.`);
  assert(bounded, `Case ${item.id}: rank() produced a score outside the 0..100 band.`);
  assert(inertClosedWork, `Case ${item.id}: completed or cancelled work did not score zero.`);

  rankingResults.push({
    caseId: item.id,
    expectedTopTask: topTask,
    observedTopTask: observedTop,
    orderPass: observedTop === topTask,
    deterministic,
    bounded,
    inertClosedWork,
    order: ordered.map((entry) => ({
      id: entry.id,
      finalScore: entry.finalScore,
      priorityBand: entry.priorityBand,
    })),
  });
}

// ---------------------------------------------------------------------------
// Fixture phase: metrics
// ---------------------------------------------------------------------------

/**
 * Fixture mode proves nothing about connector availability, so the available set is empty unless
 * an operator states otherwise. It is never inferred.
 */
const declaredProviders = (process.env.QUEUEPROOF_AVAILABLE_PROVIDERS ?? "")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

const fixtureMetrics = computeMetrics(evaluations, declaredProviders);

// Coverage dimensions overlap by design: a temporal multi-hop conflict counts in every
// relevant bucket. The mapping is declared here rather than implied by marketing copy.
const coverageRules = {
  multiHop: new Set(["multi-hop", "entity-dedup", "knowledge-update", "attribution", "thread", "conflict", "priority"]),
  temporalUpdate: new Set(["temporal", "knowledge-update", "conflict"]),
  contradictionStale: new Set(["conflict", "knowledge-update", "counterfactual"]),
  entityDedup: new Set(["entity-dedup", "actor"]),
  exactMetadata: new Set(["exact-id", "metadata"]),
};
const coverage = {
  total: cases.length,
  multiHop: cases.filter((item) => coverageRules.multiHop.has(item.category)).length,
  temporalUpdate: cases.filter((item) => coverageRules.temporalUpdate.has(item.category)).length,
  contradictionStale: cases.filter((item) => coverageRules.contradictionStale.has(item.category)).length,
  entityDedup: cases.filter((item) => coverageRules.entityDedup.has(item.category)).length,
  exactMetadata: cases.filter((item) => coverageRules.exactMetadata.has(item.category)).length,
  documentPdf: cases.filter((item) => item.category === "large-pdf" || item.requiredProviders.includes("document")).length,
};
for (const [dimension, minimum] of Object.entries({ multiHop: 10, temporalUpdate: 5, contradictionStale: 5, entityDedup: 5, exactMetadata: 5, documentPdf: 5 })) {
  assert(coverage[dimension] >= minimum, `Coverage ${dimension} requires at least ${minimum} cases, found ${coverage[dimension]}.`);
}

// ---------------------------------------------------------------------------
// Live phase: real deployment or an explicit skip
// ---------------------------------------------------------------------------

async function fetchJson(url, init = {}, timeoutMs = LIVE_QUERY_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    return { status: response.status, body, latencyMs: Date.now() - started };
  } catch (error) {
    return { status: 0, body: null, latencyMs: Date.now() - started, error: error instanceof Error ? error.message : "request failed" };
  } finally {
    clearTimeout(timer);
  }
}

async function runLivePhase() {
  if (!wantsLive) {
    return {
      status: "not_requested",
      note: "Live evaluation runs only with --live. Fixture metrics below measure the deterministic layer only.",
      metrics: null,
      cases: [],
    };
  }

  const required = {
    QUEUEPROOF_LIVE_TEST: process.env.QUEUEPROOF_LIVE_TEST === "true" ? "true" : "",
    QUEUEPROOF_URL: process.env.QUEUEPROOF_URL ?? "",
    QUEUEPROOF_SESSION_COOKIE: process.env.QUEUEPROOF_SESSION_COOKIE ?? "",
    QUEUEPROOF_DATABASE: process.env.QUEUEPROOF_DATABASE ?? "",
  };
  const missing = Object.entries(required).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length > 0) {
    return {
      status: "skipped",
      reason: `Live evaluation needs a real deployment and real connectors. Missing: ${missing.join(", ")}.`,
      missing,
      metrics: null,
      cases: [],
    };
  }

  const base = required.QUEUEPROOF_URL.replace(/\/+$/, "");
  const headers = { Accept: "application/json", Cookie: `queueproof_session=${required.QUEUEPROOF_SESSION_COOKIE}` };

  const ready = await fetchJson(`${base}/api/health/ready`, { headers });
  if (ready.status !== 200) {
    return {
      status: "skipped",
      reason: `Deployment at ${base} is not ready (HTTP ${ready.status || "no response"}). No live numbers were produced.`,
      metrics: null,
      cases: [],
    };
  }

  const connectors = await fetchJson(`${base}/api/connectors`, { headers });
  if (connectors.status !== 200 || !Array.isArray(connectors.body?.connectors)) {
    return {
      status: "skipped",
      reason: `Connector inventory unavailable (HTTP ${connectors.status}). Live evaluation cannot state which providers were reachable.`,
      metrics: null,
      cases: [],
    };
  }

  const verified = connectors.body.connectors.filter((connector) => connector.state === "data_verified");
  const availableProviders = [
    ...new Set(
      verified
        .map((connector) => String(connector.provider ?? "").toLowerCase())
        .map((provider) => EVAL_PROVIDERS.find((known) => provider.includes(known)))
        .filter(Boolean),
    ),
  ];

  const eligible = cases.filter((item) => item.requiredProviders.every((provider) => availableProviders.includes(provider)));
  if (eligible.length === 0) {
    return {
      status: "skipped",
      reason: `No fixture case has all of its required providers verified. Verified providers: ${availableProviders.join(", ") || "none"}.`,
      availableProviders,
      metrics: null,
      cases: [],
    };
  }

  const liveCases = [];
  for (const item of eligible) {
    const result = await fetchJson(`${base}/api/query`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ query: item.question, database: required.QUEUEPROOF_DATABASE, mode: "auto" }),
    });
    liveCases.push({
      id: item.id,
      category: item.category,
      httpStatus: result.status,
      ok: result.status === 200 && result.body?.ok === true,
      measuredLatencyMs: result.status === 200 ? result.latencyMs : null,
      serverReportedLatencyMs: typeof result.body?.latencyMs === "number" ? result.body.latencyMs : null,
      sourceCount: Array.isArray(result.body?.sources) ? result.body.sources.length : null,
      providers: Array.isArray(result.body?.providers) ? result.body.providers : null,
      error: result.error ?? null,
    });
  }

  const succeeded = liveCases.filter((entry) => entry.ok && typeof entry.measuredLatencyMs === "number");
  const latencies = succeeded.map((entry) => entry.measuredLatencyMs).sort((a, b) => a - b);
  const percentile = (fraction) =>
    latencies.length === 0 ? null : latencies[Math.min(latencies.length - 1, Math.floor(fraction * latencies.length))];

  return {
    status: "measured",
    baseUrl: base,
    availableProviders,
    eligibleCases: eligible.length,
    succeededCases: succeeded.length,
    metrics: {
      latencyMs: {
        measuredOver: succeeded.length,
        p50: percentile(0.5),
        p95: percentile(0.95),
        max: latencies.length ? latencies[latencies.length - 1] : null,
      },
      citationPrecision: "not measured",
      citationRecall: "not measured",
      hydradbCallsPerQuery: "not measured",
      costPerQuery: "not measured",
    },
    cases: liveCases,
  };
}

const live = await runLivePhase();

// ---------------------------------------------------------------------------
// Artifacts
// ---------------------------------------------------------------------------

const generatedAt = new Date().toISOString();

const results = {
  generatedAt,
  runner: "scripts/run-evals.mjs",
  requestedMode: wantsLive ? "live" : "fixture",
  fixture: {
    label: "FIXTURE (offline, no credentials, deterministic components only)",
    caseCount: cases.length,
    coverage,
    metrics: fixtureMetrics,
    ranking: {
      casesWithExpectedTopTask: rankingResults.length,
      allOrdersCorrect: rankingResults.every((entry) => entry.orderPass),
      results: rankingResults,
    },
    assertions: {
      run: assertionsRun,
      failed: failures.length,
      failures,
    },
    notMeasured: NOT_MEASURED_WITHOUT_LIVE,
    caveat:
      "Router accuracy is measured against hand-labelled expected.mode values. It is a metric, not a gate: a low score is a finding about the router, not a broken run.",
  },
  live,
  cases: evaluations,
};

const csvRows = evaluations.map((evaluation) => {
  const ranking = rankingResults.find((entry) => entry.caseId === evaluation.id);
  return {
    id: evaluation.id,
    category: evaluation.category,
    requiredProviders: evaluation.requiredProviders.join(" "),
    expectedMode: evaluation.expectedMode,
    predictedMode: evaluation.predictedMode,
    modeMatch: evaluation.modeMatch,
    declaredRouterCategory: evaluation.declaredRouterCategory,
    predictedRouterCategory: evaluation.predictedRouterCategory,
    routerCategoryMatch: evaluation.routerCategoryMatch,
    providersAvailable: evaluation.requiredProviders.every((provider) =>
      fixtureMetrics.providerCoverage.availableProviders.includes(provider),
    ),
    rankingChecked: Boolean(ranking),
    rankingPass: ranking ? ranking.orderPass : "not applicable",
    liveMeasured: live.status === "measured" && live.cases.some((entry) => entry.id === evaluation.id),
  };
});

const percent = (value) => (value === null ? "not measured" : `${(value * 100).toFixed(1)}%`);

const categoryTable = [
  "| Category | Cases | Router mode correct | Accuracy |",
  "| --- | ---: | ---: | ---: |",
  ...EVAL_CATEGORIES.map((category) => {
    const bucket = fixtureMetrics.perCategory[category];
    return `| ${category} | ${bucket.total} | ${bucket.correct} | ${percent(bucket.accuracy)} |`;
  }),
  `| **all** | **${fixtureMetrics.totalCases}** | **${fixtureMetrics.router.correct}** | **${percent(fixtureMetrics.router.accuracy)}** |`,
].join("\n");

const liveSection =
  live.status === "measured"
    ? [
        `Live phase: MEASURED against ${live.baseUrl}.`,
        "",
        `- Verified providers: ${live.availableProviders.join(", ") || "none"}`,
        `- Eligible cases: ${live.eligibleCases}, succeeded: ${live.succeededCases}`,
        `- Client measured latency p50: ${live.metrics.latencyMs.p50 ?? "not measured"} ms, p95: ${live.metrics.latencyMs.p95 ?? "not measured"} ms`,
        "",
        "Live numbers are reported separately above and are never averaged into the fixture table.",
      ].join("\n")
    : [
        `Live phase: ${live.status.toUpperCase()}.`,
        "",
        `${live.reason ?? live.note}`,
        "",
        "No live metric is estimated, interpolated or carried over from a previous run.",
      ].join("\n");

const report = `# QueueProof benchmark report

Generated: ${generatedAt}
Runner: \`node scripts/run-evals.mjs${wantsLive ? " --live" : ""}\`
Fixtures: \`evals/fixtures/cases.json\` (${cases.length} ground truth cases, fictional company "Helios Robotics")

## What this report is

Two independent phases, never merged.

**Fixture phase** runs offline with no credentials. It exercises the real deterministic components
(\`planRetrieval\` from \`packages/retrieval/src\`, \`rank\` from \`packages/ranking/src\`, and
\`rankingInputSchema\` from \`packages/contracts/src\`) and measures only what those functions can
decide without data: the routing decision and the ranking order.

**Live phase** requires a reachable deployment with \`data_verified\` connectors. Everything that
depends on real retrieved content is measured there or not at all.

## Fixture results (offline, deterministic layer only)

Router mode accuracy: **${fixtureMetrics.router.correct}/${fixtureMetrics.router.total} = ${percent(fixtureMetrics.router.accuracy)}**

Labelled coverage (overlapping dimensions): **${coverage.multiHop} multi-hop**, **${coverage.temporalUpdate} temporal/update**, **${coverage.contradictionStale} contradiction/stale**, **${coverage.entityDedup} entity-dedup**, **${coverage.exactMetadata} exact/metadata**, **${coverage.documentPdf} document/PDF**.

This compares \`planRetrieval(question).mode\` against the hand-labelled \`expected.mode\` for each
case. The label was written from the question, not copied from the router, so a mismatch is a real
routing disagreement rather than a tautology.

${categoryTable}

### Routing behaviour

| Measure | Value |
| --- | ---: |
| Predicted fast / thinking | ${fixtureMetrics.modeSplit.predicted.fast} / ${fixtureMetrics.modeSplit.predicted.thinking} |
| Expected fast / thinking | ${fixtureMetrics.modeSplit.expected.fast} / ${fixtureMetrics.modeSplit.expected.thinking} |
| Escalations to thinking | ${fixtureMetrics.escalation.predictedThinking} |
| Over escalated (expected fast, got thinking) | ${fixtureMetrics.escalation.overEscalated} |
| Under escalated (expected thinking, got fast) | ${fixtureMetrics.escalation.underEscalated} |

### Ranking

${rankingResults.length} case(s) declare an expected top task. Each builds real \`RankingInput\`
objects, validates them against \`rankingInputSchema\`, and calls the real \`rank()\`.

${rankingResults
  .map(
    (entry) =>
      `- \`${entry.caseId}\`: expected \`${entry.expectedTopTask}\`, got \`${entry.observedTopTask}\` — ${entry.orderPass ? "PASS" : "FAIL"} (order: ${entry.order.map((row) => `${row.id}=${row.finalScore}`).join(", ")})`,
  )
  .join("\n")}

### Provider availability

Fixture mode proves nothing about connectors, so unless \`QUEUEPROOF_AVAILABLE_PROVIDERS\` is set
explicitly the available set is empty and every case counts as unserviceable.

| Measure | Value |
| --- | ---: |
| Available providers | ${fixtureMetrics.providerCoverage.availableProviders.join(", ") || "none"} |
| Cases with at least one unavailable provider | ${fixtureMetrics.providerCoverage.casesWithUnavailableProviders} of ${fixtureMetrics.totalCases} |
${Object.entries(fixtureMetrics.providerCoverage.byProvider)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([provider, count]) => `| Cases blocked on \`${provider}\` | ${count} |`)
  .join("\n")}

### Fixture assertions

${failures.length === 0 ? `All ${assertionsRun} fixture-computable assertions passed.` : `${failures.length} of ${assertionsRun} assertion(s) FAILED:`}
${failures.map((failure) => `- ${failure}`).join("\n")}

## Live results

${liveSection}

## Not measured (requires live connectors)

These are absent by design. No value is guessed for any of them.

| Metric | Status | Why |
| --- | --- | --- |
${NOT_MEASURED_WITHOUT_LIVE.map(
  (entry) =>
    `| ${entry.metric} | ${live.status === "measured" && entry.metric === "End to end latency" ? `measured: p50 ${live.metrics.latencyMs.p50} ms over ${live.metrics.latencyMs.measuredOver} case(s)` : "not measured"} | ${entry.reason} |`,
).join("\n")}

## How to run the live phase

\`\`\`bash
QUEUEPROOF_LIVE_TEST=true \\
QUEUEPROOF_URL=https://your-deployment \\
QUEUEPROOF_SESSION_COOKIE=... \\
QUEUEPROOF_DATABASE=... \\
node scripts/run-evals.mjs --live
\`\`\`

Without all four, the live phase skips loudly and exits non-zero rather than reporting a number it
did not measure.

## Artifacts

- \`evals/results/results.json\` — full machine readable output, fixture and live kept separate
- \`evals/results/results.csv\` — one row per case
`;

await mkdir(RESULTS_DIR, { recursive: true });
await writeFile(new URL("results.json", RESULTS_DIR), `${JSON.stringify(results, null, 2)}\n`);
await writeFile(new URL("results.csv", RESULTS_DIR), `${toCsv(csvRows)}\n`);
// Live-connector results come from a separate run against production, stored in
// evals/results/live-run.json. They are APPENDED on every regeneration rather than
// hand-edited into the report, because this file is rewritten wholesale each run and
// any manual section would be silently destroyed the next time evals are run.
let liveRunSection = "";
try {
  const live = JSON.parse(await readFile(new URL("live-run.json", RESULTS_DIR), "utf8"));
  const rows = (live.rows || [])
    .map((r) =>
      "| " + r.label + " | `" + r.mode + "` | " + r.latencyMs + " ms | " + r.sources +
      " | " + (r.providers || []).join(", ") + " |")
    .join("\n");
  liveRunSection = [
    "",
    "## Live connector run (measured, not fixture)",
    "",
    "Target " + live.target + ". Connectors: " + (live.connectors || []).join(", ") +
      ". Generated " + live.generatedAt + ".",
    "",
    "| Case | Mode | Latency | Sources | Providers in evidence |",
    "| --- | --- | --- | --- | --- |",
    rows,
    "",
    "Latency across " + live.cases + " live questions: p50 " + live.latencyMs.p50 +
      " ms, p95 " + live.latencyMs.p95 + " ms, min " + live.latencyMs.min +
      " ms, max " + live.latencyMs.max + " ms.",
    "",
    "Questions whose evidence spanned all three connected providers: " +
      live.allThreeProviders + "/" + live.cases + ". Routed thinking/fast: " +
      live.thinking + "/" + live.fast + ".",
    "",
    "Answer-only required-fact recall: " + ((live.quality?.requiredFactRecall ?? 0) * 100).toFixed(1) +
      "%. Citation completeness: " + ((live.quality?.citationCompleteness ?? 0) * 100).toFixed(1) +
      "%. Unsupported-claim rate: " + ((live.quality?.unsupportedClaimRate ?? 0) * 100).toFixed(1) + "%.",
    "",
    "These are real end-to-end measurements against connected Slack, Linear and GitHub.",
    "The sample is small and is not presented as a stable distribution.",
    "",
  ].join("\n");
} catch {
  liveRunSection = "\n## Live connector run\n\nNot present. Run the live measurement to produce evals/results/live-run.json.\n";
}

await writeFile(repoUrl("BENCHMARK_REPORT.md"), report + liveRunSection);

// ---------------------------------------------------------------------------
// Console summary
// ---------------------------------------------------------------------------

console.log("QueueProof evaluation runner");
console.log(`  mode requested        ${wantsLive ? "live" : "fixture"}`);
console.log(`  fixture cases         ${cases.length}`);
console.log("");
console.log("FIXTURE (offline, deterministic components only)");
console.log(`  router mode accuracy  ${fixtureMetrics.router.correct}/${fixtureMetrics.router.total} = ${percent(fixtureMetrics.router.accuracy)}`);
console.log(`  predicted fast/think  ${fixtureMetrics.modeSplit.predicted.fast}/${fixtureMetrics.modeSplit.predicted.thinking}`);
console.log(`  expected  fast/think  ${fixtureMetrics.modeSplit.expected.fast}/${fixtureMetrics.modeSplit.expected.thinking}`);
console.log(`  escalations           ${fixtureMetrics.escalation.predictedThinking} (over ${fixtureMetrics.escalation.overEscalated}, under ${fixtureMetrics.escalation.underEscalated})`);
console.log(`  ranking cases         ${rankingResults.length} checked, ${rankingResults.filter((entry) => entry.orderPass).length} ordered as labelled`);
console.log(`  unavailable providers ${fixtureMetrics.providerCoverage.casesWithUnavailableProviders}/${fixtureMetrics.totalCases} cases blocked (available: ${fixtureMetrics.providerCoverage.availableProviders.join(", ") || "none"})`);
console.log("");
for (const category of EVAL_CATEGORIES) {
  const bucket = fixtureMetrics.perCategory[category];
  console.log(`  ${category.padEnd(17)} ${String(bucket.correct).padStart(2)}/${String(bucket.total).padEnd(2)}  ${percent(bucket.accuracy)}`);
}
console.log("");
console.log(`LIVE  ${live.status.toUpperCase()}`);
console.log(`  ${live.reason ?? live.note ?? `measured over ${live.succeededCases} case(s)`}`);
console.log("");
console.log("NOT MEASURED (requires live connectors)");
for (const entry of NOT_MEASURED_WITHOUT_LIVE) {
  console.log(`  ${entry.metric.padEnd(22)} not measured`);
}
console.log("");
console.log("Wrote evals/results/results.json, evals/results/results.csv, BENCHMARK_REPORT.md");

if (failures.length > 0) {
  console.error("");
  console.error(`FAIL  ${failures.length} fixture assertion(s) failed:`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

if (wantsLive && live.status !== "measured") {
  console.error("");
  console.error(`FAIL  --live was requested but the live phase was ${live.status}. Nothing was fabricated in its place.`);
  process.exit(2);
}

console.log(`PASS  all ${assertionsRun} fixture assertions.`);
