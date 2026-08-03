import { writeFile } from "node:fs/promises";
import process from "node:process";

const args = process.argv.slice(2);
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};
const target = (valueAfter("--url") ?? process.env.QUEUEPROOF_URL ?? "https://queueproof.vercel.app").replace(/\/$/, "");
const output = valueAfter("--out") ?? "evals/results/live-run.json";

const cases = [
  {
    label: "three-provider multi-hop",
    question: "Who escalated the AuthShield outage, what did engineering commit to, and is the fix already merged?",
    expected: "Northwind escalated AuthShield; engineering committed to ship by 7 August; GitHub reports the fix merged.",
    signals: ["northwind", "commit", "merged"],
  },
  {
    label: "deadline conflict",
    question: "Which sources disagree about the billing migration deadline?",
    expected: "The answer must preserve the 7 August versus 14 August deadline disagreement and cite the sources.",
    signals: ["7 august", "14 august"],
  },
  {
    label: "untracked commitment",
    question: "Which promise to Northwind has no issue tracking it?",
    expected: "The written incident post-mortem promised by 10 August is not tracked in Linear.",
    signals: ["post-mortem", "10 august"],
  },
  {
    label: "stale tracked work",
    question: "Which open issue appears to be already resolved elsewhere?",
    expected: "The AuthShield fix is merged or shipped while its tracked issue remains open.",
    signals: ["merged", "open"],
  },
  {
    label: "actor reconstruction",
    question: "Who is Priya Raman and what has she been working on?",
    expected: "Priya Raman is tied to the Northwind/AuthShield incident and Atlas Launch work.",
    signals: ["priya raman", "atlas"],
  },
  {
    label: "exact identifier plus context",
    question: "What is BUG-123, who filed it, and which project is it against?",
    expected: "BUG-123 is the AuthShield/Northwind incident work, filed by Priya Raman against Atlas Launch.",
    signals: ["bug-123", "priya raman", "atlas launch"],
  },
];

const rows = [];
for (const benchmark of cases) {
  const started = Date.now();
  const response = await fetch(`${target}/api/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify({ question: benchmark.question, mode: "auto" }),
    signal: AbortSignal.timeout(40_000),
  });
  const body = await response.json();
  if (!response.ok || !body.ok) throw new Error(`${benchmark.label}: ${body.error ?? `HTTP ${response.status}`}`);
  // Ground-truth signals must appear in the answer, not merely somewhere in retrieved
  // evidence. Counting evidence would let an unsupported answer pass by association.
  const observedCorpus = String(body.answer ?? "").toLowerCase();
  const matchedSignals = benchmark.signals.filter((signal) => observedCorpus.includes(signal));
  const claims = Array.isArray(body.claims) ? body.claims : [];
  const citedClaims = claims.filter((claim) => Array.isArray(claim.citation_ids) && claim.citation_ids.length > 0);
  rows.push({
    label: benchmark.label,
    question: benchmark.question,
    expected: benchmark.expected,
    actual: String(body.answer ?? "").slice(0, 900),
    pass: matchedSignals.length === benchmark.signals.length,
    expectedSignals: benchmark.signals,
    matchedSignals,
    requiredFactRecall: benchmark.signals.length ? matchedSignals.length / benchmark.signals.length : null,
    citationCompleteness: claims.length ? citedClaims.length / claims.length : null,
    unsupportedClaimRate: claims.length ? (claims.length - citedClaims.length) / claims.length : null,
    mode: body.trace?.mode ?? "unknown",
    latencyMs: body.trace?.latencyMs ?? Date.now() - started,
    callCount: body.trace?.callCount ?? body.trace?.calls?.length ?? 0,
    sources: body.validation?.evidenceCount ?? body.evidence?.length ?? 0,
    providers: body.validation?.providerCoverage ?? [],
    costUnits: body.trace?.cost?.estimatedUnits ?? null,
    runId: body.trace?.runId ?? null,
  });
  process.stdout.write(`${rows.at(-1).pass ? "PASS" : "REVIEW"} ${benchmark.label} · ${rows.at(-1).latencyMs}ms · ${rows.at(-1).callCount} call(s)\n`);
}

const sortedLatency = rows.map((row) => row.latencyMs).sort((a, b) => a - b);
const percentile = (fraction) => sortedLatency[Math.min(sortedLatency.length - 1, Math.ceil(sortedLatency.length * fraction) - 1)];
const connectors = [...new Set(rows.flatMap((row) => row.providers))].sort();
const artifact = {
  generatedAt: new Date().toISOString(),
  runner: "scripts/run-live-benchmark.mjs",
  target,
  connectors,
  cases: rows.length,
  passed: rows.filter((row) => row.pass).length,
  allThreeProviders: rows.filter((row) => row.providers.length >= 3).length,
  thinking: rows.filter((row) => row.mode === "thinking").length,
  fast: rows.filter((row) => row.mode === "fast").length,
  latencyMs: {
    p50: percentile(.5),
    p95: percentile(.95),
    min: sortedLatency[0],
    max: sortedLatency.at(-1),
  },
  quality: {
    requiredFactRecall: rows.reduce((sum, row) => sum + (row.requiredFactRecall ?? 0), 0) / Math.max(rows.length, 1),
    citationCompleteness: rows.reduce((sum, row) => sum + (row.citationCompleteness ?? 0), 0) / Math.max(rows.length, 1),
    unsupportedClaimRate: rows.reduce((sum, row) => sum + (row.unsupportedClaimRate ?? 0), 0) / Math.max(rows.length, 1),
    note: "Required facts are matched against answer text only; cited-claim metrics use the grounded answer contract.",
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
process.stdout.write(`${artifact.passed}/${artifact.cases} cases passed · p50 ${artifact.latencyMs.p50}ms · providers ${connectors.join(", ")}\n`);
if (artifact.passed !== artifact.cases) process.exitCode = 1;
