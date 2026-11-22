#!/usr/bin/env node
/**
 * Before/after measurement for the optional citation-support verifier on the
 * hand-labelled fixture pairs in evals/fixtures/citation-support-pairs.json.
 *
 * (a) verbatim: the text check of claimSupportedByCitation in
 *     evals/lib/grounded-grader.mjs (normalised passage includes normalised claim;
 *     the provider check does not apply to bare pairs).
 * (b) sidecar: POST {QUEUEPROOF_RERANKER_URL}/score, supported when score >= threshold.
 *     Skipped unless QUEUEPROOF_RERANKER_URL is set.
 *
 * Usage: pnpm eval:citation-verifier
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { normaliseGradeText } from "../evals/lib/grounded-grader.mjs";

const MAX_PAIRS = 256;
const root = new URL("../", import.meta.url);
const dataset = JSON.parse(readFileSync(new URL("evals/fixtures/citation-support-pairs.json", root), "utf8"));
const rows = dataset.rows;

function metrics(predictions) {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  rows.forEach((row, index) => {
    const actual = row.label === "supported";
    const predicted = predictions[index];
    if (predicted && actual) tp += 1;
    else if (predicted && !actual) fp += 1;
    else if (!predicted && actual) fn += 1;
    else tn += 1;
  });
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  return {
    accuracy: (tp + tn) / rows.length,
    precision,
    recall,
    f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0,
    confusion: { tp, fp, tn, fn },
  };
}

function verbatim(row) {
  const claim = normaliseGradeText(row.claim);
  return claim.length > 0 && normaliseGradeText(row.passage).includes(claim);
}

async function sidecarScores(url) {
  const scores = [];
  let model = "unknown";
  for (let start = 0; start < rows.length; start += MAX_PAIRS) {
    const pairs = rows.slice(start, start + MAX_PAIRS).map(({ claim, passage }) => ({ claim, passage }));
    const response = await fetch(new URL("/score", url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pairs }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw new Error(`sidecar returned HTTP ${response.status}`);
    const body = await response.json();
    if (!Array.isArray(body.scores) || body.scores.length !== pairs.length) {
      throw new Error("sidecar returned a malformed score list");
    }
    scores.push(...body.scores);
    model = typeof body.model === "string" ? body.model : model;
  }
  return { scores, model };
}

const byKind = (predictions) => Object.fromEntries(
  [...new Set(rows.map((row) => row.kind))].map((kind) => {
    const indices = rows.flatMap((row, index) => row.kind === kind ? [index] : []);
    const correct = indices.filter((index) => predictions[index] === (rows[index].label === "supported")).length;
    return [kind, { rows: indices.length, correct }];
  }),
);

const verbatimPredictions = rows.map(verbatim);
const result = {
  dataset: "evals/fixtures/citation-support-pairs.json",
  note: dataset.description,
  counts: dataset.counts,
  verbatim: { ...metrics(verbatimPredictions), byKind: byKind(verbatimPredictions) },
  sidecar: null,
};

const url = process.env.QUEUEPROOF_RERANKER_URL?.trim();
if (url) {
  const threshold = Number(process.env.QUEUEPROOF_RERANKER_THRESHOLD ?? 0.5);
  const { scores, model } = await sidecarScores(url);
  const predictions = scores.map((score) => score >= threshold);
  result.sidecar = {
    model,
    threshold,
    ...metrics(predictions),
    byKind: byKind(predictions),
    scores: rows.map((row, index) => ({ id: row.id, label: row.label, score: scores[index] })),
  };
}

const show = (name, m) => console.log(
  `${name.padEnd(9)} accuracy=${m.accuracy.toFixed(3)} precision=${m.precision.toFixed(3)} ` +
  `recall=${m.recall.toFixed(3)} f1=${m.f1.toFixed(3)} ${JSON.stringify(m.confusion)}`,
);
console.log(`rows=${rows.length} supported=${dataset.counts.supported} not_supported=${dataset.counts.not_supported}`);
show("verbatim", result.verbatim);
if (result.sidecar) show("sidecar", result.sidecar);
else console.log("sidecar   skipped (QUEUEPROOF_RERANKER_URL not set)");

mkdirSync(new URL("evals/results/", root), { recursive: true });
writeFileSync(new URL("evals/results/citation-verifier.json", root), JSON.stringify(result, null, 2) + "\n");
console.log("wrote evals/results/citation-verifier.json");
