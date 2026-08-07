import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [packageSource, deploySource, gateSource, healthSource] = await Promise.all([
  readFile("package.json", "utf8"),
  readFile("scripts/deploy-prod.mjs", "utf8"),
  readFile("scripts/release-gate.mjs", "utf8"),
  readFile("app/api/health/live/route.ts", "utf8"),
]);
const packageJson = JSON.parse(packageSource);

assert.equal(packageJson.private, true, "QueueProof must remain a private package.");
assert.equal(packageJson.packageManager, "pnpm@10.33.0", "The release package manager must stay pinned.");
assert.equal(packageJson.homepage, "https://queueproof.vercel.app", "The canonical product URL drifted.");
assert.equal(
  packageJson.scripts?.build,
  "node ./node_modules/next/dist/bin/next build --webpack",
  "The default build must match Vercel's native Next.js webpack build.",
);
assert.equal(
  packageJson.scripts?.["build:cloudflare"],
  "node ./node_modules/vinext/dist/cli.js build",
  "The legacy vinext build must remain explicit and separate from production.",
);
assert.equal(packageJson.scripts?.["deploy:prod"], "node scripts/deploy-prod.mjs");
assert.equal(packageJson.scripts?.["release:verify"], "node scripts/release-gate.mjs");
assert.match(deploySource, /vercel@58\.7\.1/, "Production deploys must use the pinned Vercel CLI.");
assert.match(deploySource, /VERCEL_PROJECT_ID/, "Production deploys must target an explicit Vercel project.");
assert.match(deploySource, /VERCEL_ORG_ID/, "Production deploys must target an explicit Vercel team.");
assert.doesNotMatch(deploySource, /\.vercel\/project\.json/, "Deploys must not depend on an untracked local project link.");
for (const receiptField of [
  "commitSha", "commitRef", "deploymentId", "deploymentTimestamp", "benchmarkReceiptVersion",
]) {
  assert.ok(healthSource.includes(receiptField), `Live health is missing ${receiptField}.`);
}
for (const releaseSurface of [
  "/sign-in", "/support", "/privacy", "/terms",
  "/api/workspace", "/manifest.webmanifest", "/.well-known/oauth-protected-resource/mcp", "/mcp",
]) {
  assert.ok(gateSource.includes(releaseSurface), `Production verification is missing ${releaseSurface}.`);
}

console.log(
  "PASS  local Vercel release contract is pinned and receipt-verifiable; a live deployment still requires release:verify",
);
