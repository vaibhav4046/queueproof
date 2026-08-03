import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import { GROUNDED_GRADER_VERSION, gradeGroundedAnswer } from "../evals/lib/grounded-grader.mjs";

const args = process.argv.slice(2);
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};
const target = (valueAfter("--url") ?? process.env.QUEUEPROOF_URL ?? "https://queueproof.vercel.app").replace(/\/$/, "");
const output = valueAfter("--out") ?? "evals/results/live-run.json";
const cases = JSON.parse(await readFile(new URL("../evals/fixtures/live-cases.json", import.meta.url), "utf8"));

async function ask(question) {
  const started = Date.now();
  try {
    const response = await fetch(`${target}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ question, mode: "auto" }),
      signal: AbortSignal.timeout(40_000),
    });
    let body = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    return {
      httpOk: response.ok,
      status: response.status,
      body: body && typeof body === "object" ? body : {},
      measuredLatencyMs: Date.now() - started,
      error: body?.error ?? (!response.ok ? `HTTP ${response.status}` : body ? null : "Response was not JSON."),
    };
  } catch (error) {
    return {
      httpOk: false,
      status: 0,
      body: {},
      measuredLatencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : "Request failed.",
    };
  }
}

const rows = [];
for (const benchmark of cases) {
  const result = await ask(benchmark.question);
  const body = result.body;
  const reportedProviders = body.retrieval_receipt?.provider_coverage ?? body.validation?.providerCoverage ?? [];
  const grade = gradeGroundedAnswer({
    answer: body.answer,
    claims: body.claims,
    citations: body.citations,
    contradictions: body.contradictions,
    providerCoverage: reportedProviders,
    requiredFacts: benchmark.requiredFacts,
    requiredProviders: benchmark.requiredProviders,
    requiresContradiction: benchmark.requiresContradiction,
  });
  const apiOk = result.httpOk && body.ok === true;
  const row = {
    id: benchmark.id,
    label: benchmark.label,
    question: benchmark.question,
    expected: benchmark.expected,
    actual: String(body.answer ?? "").slice(0, 1_500),
    pass: apiOk && grade.pass,
    apiOk,
    httpStatus: result.status,
    error: result.error,
    requiredFacts: benchmark.requiredFacts,
    matchedFacts: grade.matchedFacts,
    missingFacts: grade.missingFacts,
    matchedFactCount: grade.matchedFactCount,
    requiredFactCount: grade.requiredFactCount,
    requiredFactRecall: grade.requiredFactRecall,
    requiredProviders: grade.requiredProviders,
    providers: grade.supportedProviders,
    reportedProviders: grade.reportedProviders,
    missingProviders: grade.missingProviders,
    reportedWithoutSupportingCitation: grade.reportedWithoutSupportingCitation,
    citedButUnreportedProviders: grade.citedButUnreportedProviders,
    providerPass: grade.providerPass,
    requiresContradiction: grade.requiresContradiction,
    contradictionPass: grade.contradictionPass,
    contradictions: Array.isArray(body.contradictions) ? body.contradictions : [],
    supportedContradictions: grade.supportedContradictions,
    citationPass: grade.citationPass,
    citationPrecision: grade.citationPrecision,
    citationCompleteness: grade.citationCompleteness,
    unsupportedClaimRate: grade.unsupportedClaimRate,
    invalidCitationIds: grade.invalidCitationIds,
    unsupportedClaims: grade.unsupportedClaims,
    citedSources: grade.citedSources,
    claimCount: grade.claimCount,
    supportedClaimCount: grade.supportedClaimCount,
    claimCitationPairCount: grade.claimCitationPairCount,
    supportedClaimCitationPairCount: grade.supportedClaimCitationPairCount,
    mode: body.retrieval_receipt?.hydradb_mode ?? body.trace?.mode ?? "unknown",
    latencyMs: body.retrieval_receipt?.total_latency_ms ?? body.trace?.latencyMs ?? result.measuredLatencyMs,
    measuredLatencyMs: result.measuredLatencyMs,
    callCount: body.retrieval_receipt?.hydradb_call_count ?? body.trace?.callCount ?? body.trace?.calls?.length ?? 0,
    sources: body.validation?.evidenceCount ?? body.evidence?.length ?? 0,
    costUnits: body.retrieval_receipt?.estimated_cost_units ?? body.trace?.cost?.estimatedUnits ?? null,
    runId: body.retrieval_receipt?.query_id ?? body.trace?.runId ?? null,
  };
  rows.push(row);
  process.stdout.write(
    `${row.pass ? "PASS" : "REVIEW"} ${benchmark.label} · ${row.matchedFactCount}/${row.requiredFactCount} facts · ` +
    `${row.providers.join(", ") || "no supported providers"} · ${row.latencyMs}ms\n`,
  );
}

const percentile = (values, fraction) => {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] : null;
};
const median = (values) => percentile(values, 0.5);
const latencyValues = rows.map((row) => row.latencyMs);
const fastLatency = rows.filter((row) => row.mode === "fast").map((row) => row.latencyMs);
const thinkingLatency = rows.filter((row) => row.mode === "thinking").map((row) => row.latencyMs);
const calls = rows.map((row) => row.callCount).filter((value) => Number.isFinite(value));
const connectors = [...new Set(rows.flatMap((row) => row.providers))].sort();
const totalRequiredFacts = rows.reduce((sum, row) => sum + row.requiredFactCount, 0);
const totalMatchedFacts = rows.reduce((sum, row) => sum + row.matchedFactCount, 0);
const totalClaims = rows.reduce((sum, row) => sum + row.claimCount, 0);
const totalSupportedClaims = rows.reduce((sum, row) => sum + row.supportedClaimCount, 0);
const totalCitationPairs = rows.reduce((sum, row) => sum + row.claimCitationPairCount, 0);
const totalSupportedCitationPairs = rows.reduce((sum, row) => sum + row.supportedClaimCitationPairCount, 0);
const ratio = (numerator, denominator) => denominator > 0 ? numerator / denominator : null;
const requiredContradictionRows = rows.filter((row) => row.requiresContradiction);

const artifact = {
  generatedAt: new Date().toISOString(),
  grader: GROUNDED_GRADER_VERSION,
  runner: "scripts/run-live-benchmark.mjs",
  fixture: "evals/fixtures/live-cases.json",
  target,
  connectors,
  cases: rows.length,
  passed: rows.filter((row) => row.pass).length,
  allThreeProviders: rows.filter((row) => row.providers.length >= 3).length,
  thinking: rows.filter((row) => row.mode === "thinking").length,
  fast: rows.filter((row) => row.mode === "fast").length,
  latencyMs: {
    p50: percentile(latencyValues, 0.5),
    p95: percentile(latencyValues, 0.95),
    min: latencyValues.length ? Math.min(...latencyValues) : null,
    max: latencyValues.length ? Math.max(...latencyValues) : null,
    fast: { count: fastLatency.length, p50: percentile(fastLatency, 0.5), p95: percentile(fastLatency, 0.95) },
    thinking: { count: thinkingLatency.length, p50: percentile(thinkingLatency, 0.5), p95: percentile(thinkingLatency, 0.95) },
  },
  calls: {
    median: median(calls),
    mean: calls.length ? calls.reduce((sum, value) => sum + value, 0) / calls.length : null,
    min: calls.length ? Math.min(...calls) : null,
    max: calls.length ? Math.max(...calls) : null,
  },
  quality: {
    requiredFactAccuracy: ratio(totalMatchedFacts, totalRequiredFacts),
    requiredFactRecall: ratio(totalMatchedFacts, totalRequiredFacts),
    citationPrecision: ratio(totalSupportedCitationPairs, totalCitationPairs),
    citationCompleteness: ratio(totalSupportedClaims, totalClaims),
    unsupportedClaimRate: ratio(totalClaims - totalSupportedClaims, totalClaims),
    providerRequirementPasses: rows.filter((row) => row.providerPass).length,
    contradictionRequirementPasses: requiredContradictionRows.filter((row) => row.contradictionPass).length,
    contradictionRequirementCases: requiredContradictionRows.length,
    zeroKnowinglyUnsupportedClaims: rows.every((row) => row.unsupportedClaims.length === 0 && row.invalidCitationIds.length === 0),
    note: "Required facts are explicit frozen groups. Citation metrics require IDs to resolve and claim text to occur in a same-provider cited excerpt.",
  },
  costModel: {
    unit: "weighted HydraDB query",
    fastWeight: 1,
    thinkingWeight: 3,
    usd: null,
    note: "No public per-query HydraDB price is assumed. Calls and weighted units are reported for honest relative cost comparison.",
  },
  rows,
};

if (!args.includes("--no-write")) await writeFile(output, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
process.stdout.write(
  `${artifact.passed}/${artifact.cases} cases passed · ` +
  `${totalMatchedFacts}/${totalRequiredFacts} required facts · p50 ${artifact.latencyMs.p50}ms · ` +
  `providers ${connectors.join(", ") || "none"}\n`,
);
if (artifact.passed !== artifact.cases) process.exitCode = 1;
