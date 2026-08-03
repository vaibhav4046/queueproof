#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";

const args = process.argv.slice(2);
const after = (flag) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : undefined; };
const target = (after("--url") ?? process.env.QUEUEPROOF_URL ?? "https://queueproof.vercel.app").replace(/\/$/, "");
const output = after("--out") ?? "evals/results/pdf-live-run.json";
const facts = JSON.parse(await readFile(new URL("../evals/fixtures/large-pdf-facts.json", import.meta.url), "utf8"));
const stop = new Set(["about", "after", "against", "could", "dated", "does", "from", "into", "still", "their", "there", "which", "while", "would"]);
const tokens = (value) => [...new Set(String(value).toLowerCase().match(/[a-z0-9-]{4,}/g) ?? [])]
  .filter((token) => !stop.has(token));

const rows = [];
for (const fact of facts) {
  const started = Date.now();
  const response = await fetch(`${target}/api/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify({ question: fact.question, mode: "auto" }),
    signal: AbortSignal.timeout(45_000),
  });
  const body = await response.json();
  const answer = String(body.answer ?? "");
  const expectedTokens = tokens(fact.expectedAnswer);
  const foundTokens = expectedTokens.filter((token) => answer.toLowerCase().includes(token));
  const tokenRecall = expectedTokens.length ? foundTokens.length / expectedTokens.length : 0;
  const exactIdPass = !fact.exactIdentifier || answer.toLowerCase().includes(fact.exactIdentifier.toLowerCase());
  const citations = Array.isArray(body.citations) ? body.citations : [];
  const documentReceipt = citations.some((citation) =>
    /document|pdf|handbook/i.test(`${citation.provider ?? ""} ${citation.title ?? ""}`),
  );
  rows.push({
    ...fact,
    ok: response.ok && body.ok === true,
    answer: answer.slice(0, 1200),
    pass: response.ok && body.ok === true && exactIdPass && tokenRecall >= .45 && documentReceipt,
    exactIdPass,
    tokenRecall,
    documentReceipt,
    citationCount: citations.length,
    providers: body.retrieval_receipt?.provider_coverage ?? [],
    mode: body.retrieval_receipt?.hydradb_mode ?? body.trace?.mode ?? "unknown",
    latencyMs: body.retrieval_receipt?.total_latency_ms ?? Date.now() - started,
    callCount: body.retrieval_receipt?.hydradb_call_count ?? body.trace?.callCount ?? 0,
    runId: body.retrieval_receipt?.query_id ?? body.trace?.runId ?? null,
  });
  process.stdout.write(`${rows.at(-1).pass ? "PASS" : "REVIEW"} ${fact.id} · page ${fact.page} · ${(tokenRecall * 100).toFixed(0)}% fact recall\n`);
}

const crossSourceQuestion = "According to the Helios operations handbook, what does ENG-456 require, and do Slack, Linear, or GitHub show related AuthShield work?";
const crossResponse = await fetch(`${target}/api/ask`, {
  method: "POST", headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  body: JSON.stringify({ question: crossSourceQuestion, mode: "thinking" }), signal: AbortSignal.timeout(45_000),
});
const crossBody = await crossResponse.json();
const crossCorpus = String(crossBody.answer ?? "").toLowerCase();
const crossProviders = crossBody.retrieval_receipt?.provider_coverage ?? [];
const crossSource = {
  question: crossSourceQuestion,
  answer: String(crossBody.answer ?? "").slice(0, 1200),
  providers: crossProviders,
  pass: crossResponse.ok && crossBody.ok === true && crossCorpus.includes("eng-456") &&
    crossCorpus.includes("fifteen") && new Set(crossProviders).size >= 3,
  runId: crossBody.retrieval_receipt?.query_id ?? null,
};

const latency = rows.map((row) => row.latencyMs).sort((a, b) => a - b);
const percentile = (fraction) => latency[Math.min(latency.length - 1, Math.ceil(latency.length * fraction) - 1)] ?? null;
const artifact = {
  generatedAt: new Date().toISOString(), target, runner: "scripts/run-pdf-benchmark.mjs",
  document: { filename: "helios-operations-handbook.pdf", pages: 346, sha256: "c047a3d09c45ecf97e3ed8e2115eda08ea0f6152206237955030f4304fa2ed93" },
  cases: rows.length, passed: rows.filter((row) => row.pass).length,
  canaries: {
    beginning: rows.find((row) => row.kind === "beginning_load_bearing")?.pass ?? false,
    middle: rows.find((row) => row.kind === "middle_load_bearing")?.pass ?? false,
    end: rows.find((row) => row.kind === "ending_load_bearing")?.pass ?? false,
  },
  latencyMs: { p50: percentile(.5), p95: percentile(.95), min: latency[0] ?? null, max: latency.at(-1) ?? null },
  crossSource, rows,
};
if (!args.includes("--no-write")) await writeFile(output, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
process.stdout.write(`${artifact.passed}/${artifact.cases} PDF facts passed · cross-source ${crossSource.pass ? "PASS" : "REVIEW"}\n`);
if (artifact.passed !== artifact.cases || !crossSource.pass) process.exitCode = 1;
