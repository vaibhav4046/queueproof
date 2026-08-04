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

for (const destination of ["Ask", "Priorities", "Sources", "Benchmarks", "History", "Approvals", "Developer"]) {
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
  ["/queue", "Priority queue"],
  ["/evidence", "Evidence sources"],
  ["/benchmarks", "Measured benchmarks"],
  ["/replay", "Investigation replay"],
  ["/approvals", "Approvals"],
  ["/developer", "Developer"],
  ["/owner", "Owner access"],
  ["/method", "How QueueProof works"],
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
  "useDialogBehavior", "MutationObserver(recoverFocus)", "EvidenceReceiptDialog", "aria-pressed", "Run live proof",
  "Verify sources", "Match the facts", "Cite every claim", "Approve the action",
  "missing-information", "(router?.total ?? 0) >= 30", "graded > 0", "scrollIntoView",
  "Evidence timeline", "Expected facts, observed answers", "Stop waiting", "Reproducible investigation",
  "Provider-confirmed execution", "Each frame comes from a stored benchmark artifact",
  "Strict production benchmark evidence is not available yet",
]) {
  assert.ok(appSource.includes(contract), `Missing frontend interaction contract: ${contract}`);
}
for (const forbidden of ["scheduleOrbit", "setOrbitStage", "orbitTimers"]) {
  assert.ok(!appSource.includes(forbidden), `Timer-driven proof workflow survived in the frontend: ${forbidden}`);
}
assert.match(styles, /\.app-header\s*\{\s*position:\s*sticky/);
assert.match(styles, /\.qp-app\s*>\s*\.toast\s*\{\s*position:\s*fixed/);
assert.match(styles, /max-height:\s*1100px/);
assert.match(appSource, /className="mobile-dock"\s+aria-label="Mobile navigation"/);
assert.match(styles, /\.mobile-dock\s*\{\s*display:\s*none/);
assert.match(styles, /@media \(max-width:\s*980px\)[\s\S]*?\.mobile-dock\s*\{[\s\S]*?position:\s*fixed/);
assert.ok(
  styles.includes(".evidence-orbit-stack { display: block; aspect-ratio: auto; max-height: none; }"),
  "Persisted receipt replay controls must remain in flow below the desktop Orbit and visible on mobile.",
);
for (const mobileOrder of [
  ".proof-details { order: 3;",
  ".premium-console { order: 4;",
  ".evidence-orbit-stack { order: 5;",
  ".premium-results { order: 6;",
  ".landing-proof-sections { order: 8;",
]) {
  assert.ok(styles.includes(mobileOrder), `Missing deterministic mobile proof order: ${mobileOrder}`);
}

console.log("PASS  live shell, seven-destination navigation, direct judge routes, public disclosure, proof-first layout, timeline, comparison, replay, citations, dialogs, and result-state contracts");
