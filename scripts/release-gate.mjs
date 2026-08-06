import assert from "node:assert/strict";

const readArg = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
};
const base = (readArg("--url") || process.env.QUEUEPROOF_URL || "").replace(/\/$/, "");
const intendedSha = readArg("--sha") || process.env.QUEUEPROOF_RELEASE_SHA || "";
if (!base || !intendedSha) throw new Error("Usage: npm run release:verify -- --url <production-url> --sha <intended-sha>");

const healthResponse = await fetch(`${base}/api/health/live`, { headers: { accept: "application/json" } });
assert.equal(healthResponse.status, 200, "Live health endpoint must return 200.");
const health = await healthResponse.json();
assert.ok(health.release?.commitSha, "Live health endpoint must report a commit SHA.");
assert.equal(health.release.commitSha, intendedSha, "Deployed SHA does not match the intended release SHA.");
assert.equal(health.environment, "production", "The verified deployment must report its production environment.");
assert.equal(health.release.target, "production", "The verified deployment is not a Vercel production deployment.");
assert.match(health.release.deploymentId ?? "", /^dpl_[A-Za-z0-9]+$/, "Production health must report its Vercel deployment ID.");
assert.ok(
  Number.isFinite(Date.parse(health.release.deploymentTimestamp ?? "")),
  "Production health must report a valid deployment timestamp.",
);
assert.equal(
  health.release.benchmarkReceiptVersion,
  "grounded-grader-v2",
  "Production health must report the benchmark receipt version used by /api/lab.",
);

const labResponse = await fetch(`${base}/api/lab`, { headers: { accept: "application/json" } });
assert.equal(labResponse.status, 200, "Benchmark lab endpoint must return 200.");
const lab = await labResponse.json();
assert.equal(
  lab.results?.currentRelease?.commitSha,
  intendedSha,
  "Benchmark lab release identity does not match the intended production SHA.",
);
assert.equal(
  lab.results?.currentRelease?.commitRef,
  health.release.commitRef,
  "Benchmark lab ref does not match the health receipt.",
);

const routes = ["/", "/queue", "/evidence", "/benchmarks", "/replay", "/approvals", "/developer", "/method", "/owner", "/this-route-must-not-exist"];
for (const path of routes) {
  const response = await fetch(`${base}${path}`, { headers: { accept: "text/html" } });
  assert.equal(response.status, path === "/this-route-must-not-exist" ? 404 : 200, `${path} returned ${response.status}.`);
  const html = await response.text();
  assert.match(html, /QueueProof/i, `${path} did not render the QueueProof application.`);
  if (path === "/") assert.match(html, /ember-assistant-v1/, "Production is missing the Ember assistant design-system marker.");
  if (path === "/this-route-must-not-exist") assert.match(html, /This route left no receipt\./, "Production is missing the branded 404.");
}
console.log(
  `PASS  production ${intendedSha} (${health.release.deploymentId}) serves the ember-assistant-v1 marker, ` +
  "binds /api/lab to the same release, serves nine routes, and returns the branded 404",
);
