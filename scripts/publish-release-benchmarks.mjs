#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import process from "node:process";

const args = process.argv.slice(2);
const after = (flag) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : undefined; };
const target = (after("--url") ?? process.env.QUEUEPROOF_URL ?? "https://queueproof.vercel.app").replace(/\/$/, "");
const expectedSha = (after("--sha") ?? process.env.GITHUB_SHA ?? "").toLowerCase();
const audience = `${target}/api/lab/artifacts/batch`;
const files = {
  auto: after("--auto") ?? "evals/results/release-auto.json",
  fast: after("--fast") ?? "evals/results/release-fast.json",
  thinking: after("--thinking") ?? "evals/results/release-thinking.json",
  pdf: after("--pdf") ?? "evals/results/release-pdf.json",
};
if (!/^[0-9a-f]{40}$/.test(expectedSha)) throw new Error("A 40-character expected release SHA is required.");

const artifacts = {};
for (const [kind, path] of Object.entries(files)) {
  const artifact = JSON.parse(await readFile(path, "utf8"));
  if (String(artifact?.release?.commitSha ?? "").toLowerCase() !== expectedSha) {
    throw new Error(`${kind} artifact is not bound to ${expectedSha}.`);
  }
  if (artifact?.grader !== "grounded-grader-v3" || artifact?.releaseVerified !== true) {
    throw new Error(`${kind} artifact is not a release-verified grounded-grader-v3 receipt.`);
  }
  artifacts[kind] = artifact;
}

const requestUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
const requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
if (!requestUrl || !requestToken) throw new Error("GitHub OIDC request variables are unavailable; id-token: write is required.");
const oidcUrl = new URL(requestUrl);
oidcUrl.searchParams.set("audience", audience);
const oidcResponse = await fetch(oidcUrl, {
  headers: { Authorization: `bearer ${requestToken}`, Accept: "application/json" },
  signal: AbortSignal.timeout(15_000),
});
if (!oidcResponse.ok) throw new Error(`GitHub OIDC token request failed with HTTP ${oidcResponse.status}.`);
const oidc = await oidcResponse.json();
if (typeof oidc?.value !== "string" || !oidc.value) throw new Error("GitHub OIDC response did not include a token.");

const publishResponse = await fetch(`${target}/api/lab/artifacts/batch`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${oidc.value}`,
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  },
  body: JSON.stringify({ artifacts }),
  signal: AbortSignal.timeout(30_000),
});
const publishBody = await publishResponse.json().catch(() => null);
if (!publishResponse.ok || publishBody?.ok !== true || String(publishBody?.releaseSha ?? "").toLowerCase() !== expectedSha) {
  throw new Error(`Atomic benchmark publication failed: HTTP ${publishResponse.status} ${JSON.stringify(publishBody)}`);
}

const labResponse = await fetch(`${target}/api/lab?verify=${Date.now()}`, {
  headers: { Accept: "application/json", "Cache-Control": "no-store" },
  signal: AbortSignal.timeout(15_000),
});
const lab = await labResponse.json().catch(() => null);
const results = lab?.results ?? {};
const live = results.live ?? {};
const pdf = results.pdf ?? {};
const comparison = results.modeComparison ?? {};
if (
  !labResponse.ok || lab?.ok !== true ||
  String(results?.currentRelease?.commitSha ?? "").toLowerCase() !== expectedSha ||
  live.status !== "measured" || live.storage !== "durable" || live.cases !== live.passed ||
  comparison.status !== "measured" || comparison.comparable !== true ||
  comparison?.fast?.status !== "measured" || comparison?.thinking?.status !== "measured" ||
  pdf.status !== "measured" || pdf.storage !== "durable" || pdf.cases !== pdf.passed ||
  pdf?.crossSource?.pass !== true || pdf?.crossSource?.relevancePass !== true
) {
  throw new Error(`Published benchmark verification failed: ${JSON.stringify({ currentRelease: results?.currentRelease, live, modeComparison: comparison, pdf })}`);
}

process.stdout.write(JSON.stringify({
  ok: true,
  releaseSha: expectedSha,
  artifactSetHash: publishBody.artifactSetHash,
  idempotent: publishBody.idempotent,
  live: { cases: live.cases, passed: live.passed, p50: live?.latencyMs?.p50, p95: live?.latencyMs?.p95 },
  fast: comparison.fast,
  thinking: comparison.thinking,
  pdf: { cases: pdf.cases, passed: pdf.passed, p50: pdf?.latencyMs?.p50, p95: pdf?.latencyMs?.p95, crossSource: pdf.crossSource },
}, null, 2) + "\n");
