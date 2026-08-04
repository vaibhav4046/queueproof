import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const base = (process.env.QUEUEPROOF_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const response = await fetch(`${base}/api/health/live`);
if (!response.ok) throw new Error(`QueueProof is not live: ${response.status}`);
const html = await (await fetch(base)).text();
for (const marker of ["QueueProof — One Answer. Every System. Proven.", "One answer.", "Every system."]) {
  if (!html.includes(marker)) throw new Error(`Missing rendered marker: ${marker}`);
}
const workspaceResponse = await fetch(`${base}/api/workspace`);
if (!workspaceResponse.ok) throw new Error(`Workspace bootstrap failed: ${workspaceResponse.status}`);
const workspace = await workspaceResponse.json();
if (workspace.ok !== true) throw new Error("Workspace bootstrap did not return an explicit success contract.");

for (const destination of ["Proof", "Queue", "Evidence", "Benchmarks", "Replay", "Approvals", "Developer"]) {
  assert.match(html, new RegExp(`>${destination}<`), `Missing rendered navigation destination: ${destination}`);
}
assert.match(html, /aria-current="page"/, "The active product area must be exposed to assistive technology.");
assert.match(html, /Cross-source proof question/, "The primary query field must keep a persistent accessible label.");

if (workspace.view?.actor?.publicAccess === true) {
  assert.match(html, /Public sandbox/);
  assert.match(html, /Shared evidence and proposals/);
}

for (const [path, marker] of [
  ["/demo", "Cross-source proof question"],
  ["/benchmarks", "Production evidence lab"],
  ["/method", "Search every source."],
]) {
  const routeResponse = await fetch(`${base}${path}`);
  assert.equal(routeResponse.status, 200, `${path} must be directly reachable by judges.`);
  assert.match(await routeResponse.text(), new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${path} is missing its release marker.`);
}

const [appSource, styles] = await Promise.all([
  readFile(new URL("../app/QueueProofApp.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
]);
for (const contract of [
  "useDialogBehavior", "EvidenceReceiptDialog", "aria-pressed", "Run live proof",
  "Verify sources", "Match the facts", "Cite every claim", "Approve the action",
  "missing-information", "(router?.total ?? 0) >= 30", "graded > 0", "scrollIntoView",
  "Evidence timeline", "Promised versus actual", "Stop waiting", "Reproducible investigation",
  "Verified backend receipt", "Replay verified receipt", "does not simulate routing",
]) {
  assert.ok(appSource.includes(contract), `Missing frontend interaction contract: ${contract}`);
}
for (const forbidden of ["scheduleOrbit", "setOrbitStage", "orbitTimers"]) {
  assert.ok(!appSource.includes(forbidden), `Timer-driven proof workflow survived in the frontend: ${forbidden}`);
}
assert.match(styles, /\.app-header\s*\{\s*position:\s*sticky/);
assert.match(styles, /\.qp-app\s*>\s*\.toast\s*\{\s*position:\s*fixed/);
assert.match(styles, /max-height:\s*1100px/);
assert.match(styles, /\.mobile-nav-utility\s*\{\s*display:\s*flex\s*!important/);

console.log("PASS  live shell, seven-destination navigation, direct judge routes, public disclosure, proof-first layout, timeline, comparison, replay, citations, dialogs, and result-state contracts");
