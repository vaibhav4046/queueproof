/**
 * Production promotion that keeps the running artifact SHA-verifiable.
 *
 * This project is deployed from the CLI rather than from a Vercel Git
 * integration, so Vercel injects no VERCEL_GIT_COMMIT_SHA. Without it
 * /api/health/live publishes `commitSha: null`, /api/lab refuses to bind any
 * measurement to a release, and /benchmarks degrades to
 * `awaiting_current_release_measurement`. The release identity therefore has to
 * be supplied per deployment, which is exactly what the route's
 * QUEUEPROOF_RELEASE_* fallback exists for.
 *
 * The SHA is read from git rather than accepted as an argument so it cannot
 * drift from the source that is actually uploaded, and a dirty worktree is
 * refused for the same reason: a deployment labelled with a commit must contain
 * that commit's code and nothing else.
 */
import { spawnSync } from "node:child_process";

const git = (...args) => {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${(result.stderr || "").trim()}`);
  }
  return result.stdout.trim();
};

const sha = git("rev-parse", "HEAD");
const ref = git("rev-parse", "--abbrev-ref", "HEAD");
const dirty = git("status", "--porcelain");
const projectId = process.env.VERCEL_PROJECT_ID;
const orgId = process.env.VERCEL_ORG_ID;

if (!/^[0-9a-f]{40}$/.test(sha) || !ref || ref === "HEAD") {
  console.error("BLOCKED  deployment requires a named branch and its exact 40-character git SHA.");
  process.exit(1);
}

if (!projectId || !orgId) {
  console.error("BLOCKED  set VERCEL_PROJECT_ID and VERCEL_ORG_ID to the existing production project.");
  process.exit(1);
}

if (dirty) {
  console.error("BLOCKED  worktree is not clean, so the deployed artifact would not match the published SHA.");
  console.error(dirty);
  console.error("Commit or stash the changes before deploying.");
  process.exit(1);
}

console.log(`Deploying ${sha} (${ref}) to production.`);

const deploymentTimestamp = new Date().toISOString();

const vercelArgs = [
  "deploy",
  "--prod",
  "--yes",
  "--format", "json",
  "--build-env", `QUEUEPROOF_RELEASE_SHA=${sha}`,
  "--build-env", `QUEUEPROOF_RELEASE_REF=${ref}`,
  "--build-env", `QUEUEPROOF_DEPLOYMENT_TIMESTAMP=${deploymentTimestamp}`,
  "--env", `QUEUEPROOF_RELEASE_SHA=${sha}`,
  "--env", `QUEUEPROOF_RELEASE_REF=${ref}`,
  "--env", `QUEUEPROOF_DEPLOYMENT_TIMESTAMP=${deploymentTimestamp}`,
  "--meta", `releaseSha=${sha}`,
];
const deploy = spawnSync("pnpm", ["dlx", "vercel@58.7.1", ...vercelArgs], {
  encoding: "utf8",
  stdio: ["inherit", "pipe", "inherit"],
  shell: process.platform === "win32",
});
if (deploy.stdout) process.stdout.write(deploy.stdout);
if (deploy.status !== 0) process.exit(deploy.status ?? 1);

let payload;
try {
  payload = JSON.parse(deploy.stdout || "{}");
} catch {
  console.error("BLOCKED  Vercel did not return a machine-readable deployment receipt.");
  process.exit(1);
}
const deployment = payload.deployment ?? payload;
if (!deployment.id || !deployment.url || deployment.readyState !== "READY" || deployment.target !== "production") {
  console.error("BLOCKED  Vercel did not return a READY production deployment with an ID and URL.");
  process.exit(1);
}

const canonicalUrl = (process.env.QUEUEPROOF_URL || "https://queueproof.vercel.app").replace(/\/$/, "");
const fetchJson = async (url) => {
  const response = await fetch(url, {
    headers: { Accept: "application/json", "Cache-Control": "no-store" },
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return body;
};

let health;
for (let attempt = 0; attempt < 12; attempt += 1) {
  health = await fetchJson(`${canonicalUrl}/api/health/live`);
  if (
    health.release?.commitSha === sha &&
    health.release?.commitRef === ref &&
    health.release?.deploymentId === deployment.id &&
    health.release?.deploymentTimestamp === deploymentTimestamp
  ) break;
  await new Promise((resolve) => setTimeout(resolve, 2_000));
}
if (
  health?.status !== "live" ||
  health?.environment !== "production" ||
  health?.release?.commitSha !== sha ||
  health?.release?.commitRef !== ref ||
  health?.release?.target !== "production" ||
  health?.release?.deploymentId !== deployment.id ||
  health?.release?.deploymentTimestamp !== deploymentTimestamp ||
  health?.release?.benchmarkReceiptVersion !== "grounded-grader-v2"
) {
  console.error("BLOCKED  canonical production did not converge on the new deployment identity.");
  process.exit(1);
}

const lab = await fetchJson(`${canonicalUrl}/api/lab`);
if (lab.results?.currentRelease?.commitSha !== sha || lab.results?.currentRelease?.commitRef !== ref) {
  console.error("BLOCKED  /api/lab is not bound to the deployed SHA/ref.");
  process.exit(1);
}

console.log(`\nREADY  ${deployment.id} ${deployment.url}`);
console.log(`VERIFIED  ${canonicalUrl} reports ${sha} (${ref}) in health and benchmark receipts.`);
console.log(`Run the complete route gate with:\n  pnpm release:verify -- --url ${canonicalUrl} --sha ${sha}`);
