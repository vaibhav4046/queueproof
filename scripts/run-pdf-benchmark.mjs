#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import { GROUNDED_GRADER_VERSION, gradeGroundedAnswer, summarisePdfCanaries } from "../evals/lib/grounded-grader.mjs";

const args = process.argv.slice(2);
const after = (flag) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : undefined; };
const target = (after("--url") ?? process.env.QUEUEPROOF_URL ?? "https://queueproof.vercel.app").replace(/\/$/, "");
const output = after("--out") ?? "evals/results/pdf-live-run.json";
const documentSourceId = after("--source-id") ?? "f64d374d1899f3057707528f77703f3f";
const facts = JSON.parse(await readFile(new URL("../evals/fixtures/large-pdf-facts.json", import.meta.url), "utf8"));

async function ask(payload) {
  const started = Date.now();
  try {
    const response = await fetch(`${target}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(45_000),
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

function receiptFields(body, measuredLatencyMs) {
  return {
    mode: body.retrieval_receipt?.hydradb_mode ?? body.trace?.mode ?? "unknown",
    latencyMs: body.retrieval_receipt?.total_latency_ms ?? body.trace?.latencyMs ?? measuredLatencyMs,
    measuredLatencyMs,
    callCount: body.retrieval_receipt?.hydradb_call_count ?? body.trace?.callCount ?? body.trace?.calls?.length ?? 0,
    costUnits: body.retrieval_receipt?.estimated_cost_units ?? body.trace?.cost?.estimatedUnits ?? null,
    runId: body.retrieval_receipt?.query_id ?? body.trace?.runId ?? null,
  };
}

const rows = [];
for (const fact of facts) {
  const result = await ask({ question: fact.question, mode: "auto", sourceIds: [documentSourceId] });
  const body = result.body;
  const reportedProviders = body.retrieval_receipt?.provider_coverage ?? body.validation?.providerCoverage ?? [];
  const grade = gradeGroundedAnswer({
    answer: body.answer,
    claims: body.claims,
    citations: body.citations,
    contradictions: body.contradictions,
    providerCoverage: reportedProviders,
    requiredFacts: fact.requiredFacts,
    requiredProviders: ["document"],
  });
  const answer = String(body.answer ?? "");
  const exactIdPass = !fact.exactIdentifier || answer.toLowerCase().includes(fact.exactIdentifier.toLowerCase());
  const documentReceipt = grade.supportedProviders.includes("document");
  const apiOk = result.httpOk && body.ok === true;
  const row = {
    ...fact,
    apiOk,
    httpStatus: result.status,
    error: result.error,
    answer: answer.slice(0, 1_500),
    pass: apiOk && grade.pass && exactIdPass && documentReceipt,
    exactIdPass,
    documentReceipt,
    matchedFacts: grade.matchedFacts,
    missingFacts: grade.missingFacts,
    matchedFactCount: grade.matchedFactCount,
    requiredFactCount: grade.requiredFactCount,
    requiredFactRecall: grade.requiredFactRecall,
    providerPass: grade.providerPass,
    providers: grade.supportedProviders,
    reportedProviders: grade.reportedProviders,
    missingProviders: grade.missingProviders,
    reportedWithoutSupportingCitation: grade.reportedWithoutSupportingCitation,
    citationPass: grade.citationPass,
    citationPrecision: grade.citationPrecision,
    citationCompleteness: grade.citationCompleteness,
    unsupportedClaimRate: grade.unsupportedClaimRate,
    invalidCitationIds: grade.invalidCitationIds,
    unsupportedClaims: grade.unsupportedClaims,
    citedSources: grade.citedSources,
    citationCount: Array.isArray(body.citations) ? body.citations.length : 0,
    claimCount: grade.claimCount,
    supportedClaimCount: grade.supportedClaimCount,
    claimCitationPairCount: grade.claimCitationPairCount,
    supportedClaimCitationPairCount: grade.supportedClaimCitationPairCount,
    ...receiptFields(body, result.measuredLatencyMs),
  };
  rows.push(row);
  process.stdout.write(
    `${row.pass ? "PASS" : "REVIEW"} ${fact.id} · page ${fact.page} · ` +
    `${row.matchedFactCount}/${row.requiredFactCount} required facts · ${row.citationPass ? "cited" : "citation review"}\n`,
  );
}

const crossSourceQuestion = "According to the Helios operations handbook, what does ENG-456 require, and do Slack, Linear, or GitHub show related AuthShield work?";
const crossRequiredFacts = [
  { id: "issue", label: "The requirement is tied to ENG-456", anyOf: ["ENG-456"] },
  {
    id: "english-requirement",
    label: "The English requirement reduces the AuthShield operator token lifetime to fifteen minutes",
    allOf: [["AuthShield"], ["operator token lifetime"], ["fifteen minutes"]],
  },
];
const crossResult = await ask({
  question: crossSourceQuestion,
  mode: "thinking",
  sourceIds: [documentSourceId],
  includeConnectors: true,
});
const crossBody = crossResult.body;
const crossReportedProviders = crossBody.retrieval_receipt?.provider_coverage ?? crossBody.validation?.providerCoverage ?? [];
const crossGrade = gradeGroundedAnswer({
  answer: crossBody.answer,
  claims: crossBody.claims,
  citations: crossBody.citations,
  contradictions: crossBody.contradictions,
  providerCoverage: crossReportedProviders,
  requiredFacts: crossRequiredFacts,
  requiredProviders: ["document"],
});
const nonDocumentProviders = crossGrade.supportedProviders.filter((provider) => provider !== "document");
const crossDocumentPass = crossGrade.supportedProviders.includes("document");
const connectorProviderPass = nonDocumentProviders.length >= 2;
const crossApiOk = crossResult.httpOk && crossBody.ok === true;
const crossSource = {
  question: crossSourceQuestion,
  answer: String(crossBody.answer ?? "").slice(0, 1_500),
  apiOk: crossApiOk,
  httpStatus: crossResult.status,
  error: crossResult.error,
  pass: crossApiOk && crossGrade.factPass && crossGrade.citationPass && crossDocumentPass && connectorProviderPass,
  requiredFacts: crossRequiredFacts,
  matchedFacts: crossGrade.matchedFacts,
  missingFacts: crossGrade.missingFacts,
  matchedFactCount: crossGrade.matchedFactCount,
  requiredFactCount: crossGrade.requiredFactCount,
  requiredFactRecall: crossGrade.requiredFactRecall,
  providers: crossGrade.supportedProviders,
  reportedProviders: crossGrade.reportedProviders,
  requiredProviderRule: { document: true, minimumNonDocumentProviders: 2 },
  documentProviderPass: crossDocumentPass,
  nonDocumentProviders,
  connectorProviderPass,
  missingProviderRequirements: [
    ...(!crossDocumentPass ? ["document"] : []),
    ...(connectorProviderPass ? [] : [`${2 - nonDocumentProviders.length} additional non-document provider(s)`]),
  ],
  reportedWithoutSupportingCitation: crossGrade.reportedWithoutSupportingCitation,
  citationPass: crossGrade.citationPass,
  citationPrecision: crossGrade.citationPrecision,
  citationCompleteness: crossGrade.citationCompleteness,
  unsupportedClaimRate: crossGrade.unsupportedClaimRate,
  invalidCitationIds: crossGrade.invalidCitationIds,
  unsupportedClaims: crossGrade.unsupportedClaims,
  citedSources: crossGrade.citedSources,
  citationCount: Array.isArray(crossBody.citations) ? crossBody.citations.length : 0,
  claimCount: crossGrade.claimCount,
  supportedClaimCount: crossGrade.supportedClaimCount,
  ...receiptFields(crossBody, crossResult.measuredLatencyMs),
};

const percentile = (values, fraction) => {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] : null;
};
const latency = rows.map((row) => row.latencyMs);
const calls = rows.map((row) => row.callCount).filter((value) => Number.isFinite(value));
const totalRequiredFacts = rows.reduce((sum, row) => sum + row.requiredFactCount, 0);
const totalMatchedFacts = rows.reduce((sum, row) => sum + row.matchedFactCount, 0);
const totalClaims = rows.reduce((sum, row) => sum + row.claimCount, 0);
const totalSupportedClaims = rows.reduce((sum, row) => sum + row.supportedClaimCount, 0);
const totalCitationPairs = rows.reduce((sum, row) => sum + row.claimCitationPairCount, 0);
const totalSupportedCitationPairs = rows.reduce((sum, row) => sum + row.supportedClaimCitationPairCount, 0);
const ratio = (numerator, denominator) => denominator > 0 ? numerator / denominator : null;
const artifact = {
  generatedAt: new Date().toISOString(),
  grader: GROUNDED_GRADER_VERSION,
  target,
  runner: "scripts/run-pdf-benchmark.mjs",
  fixture: "evals/fixtures/large-pdf-facts.json",
  document: {
    sourceId: documentSourceId,
    filename: "helios-operations-handbook.pdf",
    pages: 346,
    sha256: "c047a3d09c45ecf97e3ed8e2115eda08ea0f6152206237955030f4304fa2ed93",
  },
  cases: rows.length,
  passed: rows.filter((row) => row.pass).length,
  canaries: summarisePdfCanaries(rows),
  latencyMs: {
    p50: percentile(latency, 0.5),
    p95: percentile(latency, 0.95),
    min: latency.length ? Math.min(...latency) : null,
    max: latency.length ? Math.max(...latency) : null,
  },
  calls: {
    median: percentile(calls, 0.5),
    mean: calls.length ? calls.reduce((sum, value) => sum + value, 0) / calls.length : null,
    min: calls.length ? Math.min(...calls) : null,
    max: calls.length ? Math.max(...calls) : null,
  },
  quality: {
    requiredFactAccuracy: ratio(totalMatchedFacts, totalRequiredFacts),
    citationPrecision: ratio(totalSupportedCitationPairs, totalCitationPairs),
    citationCompleteness: ratio(totalSupportedClaims, totalClaims),
    unsupportedClaimRate: ratio(totalClaims - totalSupportedClaims, totalClaims),
    zeroKnowinglyUnsupportedClaims: rows.every((row) => row.unsupportedClaims.length === 0 && row.invalidCitationIds.length === 0),
  },
  crossSource,
  rows,
};
if (!args.includes("--no-write")) await writeFile(output, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
process.stdout.write(
  `${artifact.passed}/${artifact.cases} PDF facts passed · ` +
  `${totalMatchedFacts}/${totalRequiredFacts} required facts · ` +
  `cross-source ${crossSource.pass ? "PASS" : "REVIEW"}\n`,
);
if (artifact.passed !== artifact.cases || !crossSource.pass) process.exitCode = 1;
