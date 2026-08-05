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
assert.equal(health.release.target, "production", "The verified deployment is not a Vercel production deployment.");

const routes = ["/", "/queue", "/evidence", "/benchmarks", "/replay", "/approvals", "/developer", "/method", "/owner", "/this-route-must-not-exist"];
for (const path of routes) {
  const response = await fetch(`${base}${path}`, { headers: { accept: "text/html" } });
  assert.equal(response.status, path === "/this-route-must-not-exist" ? 404 : 200, `${path} returned ${response.status}.`);
  const html = await response.text();
  assert.match(html, /QueueProof/i, `${path} did not render the QueueProof application.`);
  if (path === "/") assert.match(html, /ember-assistant-v1/, "Production is missing the Ember assistant design-system marker.");
  if (path === "/this-route-must-not-exist") assert.match(html, /This route left no receipt\./, "Production is missing the branded 404.");
}
console.log(`PASS  production ${intendedSha} serves the ember-assistant-v1 marker, nine routes, and branded 404`);
