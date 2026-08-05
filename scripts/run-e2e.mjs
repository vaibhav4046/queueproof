import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const base = (process.env.QUEUEPROOF_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const response = await fetch(`${base}/api/health/live`);
if (!response.ok) throw new Error(`QueueProof is not live: ${response.status}`);
const html = await (await fetch(base)).text();
for (const marker of ["QueueProof — Ask your work. Get the proof.", "Ask your work.", "ember-assistant-v1"]) {
  if (!html.includes(marker)) throw new Error(`Missing rendered marker: ${marker}`);
}
const workspaceResponse = await fetch(`${base}/api/workspace`);
if (!workspaceResponse.ok) throw new Error(`Workspace bootstrap failed: ${workspaceResponse.status}`);
const workspace = await workspaceResponse.json();
if (workspace.ok !== true) throw new Error("Workspace bootstrap did not return an explicit success contract.");

for (const destination of ["Ask", "Today", "Sources", "History", "Use with AI", "Review changes", "Benchmarks"]) {
  assert.ok(html.includes(destination), `Missing rendered navigation destination: ${destination}`);
}
assert.match(html, /aria-current="page"/, "The active product area must be exposed to assistive technology.");
assert.match(html, /Cross-source proof question/, "The primary query field must keep a persistent accessible label.");

if (workspace.view?.actor?.publicAccess === true) {
  // A visitor who clicks the link must land in the working product, not on a token wall.
  assert.ok(!html.includes('href="/owner"'), "The public workspace must not gate a visitor behind an owner sign-in link.");
  assert.ok(!html.includes("Owner sign in"), "The public workspace must not advertise an owner sign-in prompt.");
}

for (const [path, marker] of [
  ["/demo", "Cross-source proof question"],
  ["/queue", "What matters"],
  ["/evidence", "Your sources"],
  ["/benchmarks", "The benchmark is"],
  ["/replay", "Your history"],
  ["/approvals", "without your approval."],
  ["/developer", "Connect QueueProof"],
  ["/owner", "Workspace owner"],
  ["/method", "How QueueProof works"],
]) {
  const routeResponse = await fetch(`${base}${path}`);
  assert.equal(routeResponse.status, 200, `${path} must be directly reachable by judges.`);
  assert.match(await routeResponse.text(), new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${path} is missing its release marker.`);
}

const [appSource, globalStyles, baseStyles, commandCentreStyles, emberAssistantStyles] = await Promise.all([
  readFile(new URL("../app/QueueProofApp.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  readFile(new URL("../app/product.css", import.meta.url), "utf8"),
  readFile(new URL("../app/command-centre.css", import.meta.url), "utf8"),
  readFile(new URL("../app/ember-assistant.css", import.meta.url), "utf8"),
]);
const styles = `${globalStyles}\n${baseStyles}\n${commandCentreStyles}\n${emberAssistantStyles}`;
for (const contract of [
  "useDialogBehavior", "MutationObserver(recoverFocus)", "EvidenceReceiptDialog", "aria-pressed", "Ask QueueProof",
  "Verify sources", "Match the facts", "Cite every claim", "Approve the action",
  "missing-information", "(router?.total ?? 0) >= 30", "graded > 0", "scrollIntoView",
  "Evidence timeline", "Expected facts, observed answers", "Looking across your work.", "Raw run details",
  "Large-document proof", "Facts tested from beginning to end",
  "Provider-confirmed execution", "Recorded proof-test replays",
  "Strict production benchmark evidence is not available yet",
]) {
  assert.ok(appSource.includes(contract), `Missing frontend interaction contract: ${contract}`);
}
for (const forbidden of ["scheduleOrbit", "setOrbitStage", "orbitTimers"]) {
  assert.ok(!appSource.includes(forbidden), `Timer-driven proof workflow survived in the frontend: ${forbidden}`);
}
assert.match(styles, /\.app-header\.app-sidebar\s*\{[\s\S]*?position:\s*fixed/);
assert.match(styles, /\.toast\s*\{[\s\S]*?position:\s*fixed/);
assert.match(styles, /data-design-system|Ember Assistant/i);
assert.match(appSource, /className="mobile-dock"\s+aria-label="Mobile navigation"/);
assert.match(styles, /\.mobile-dock\s*\{\s*display:\s*none/);
assert.match(styles, /@media \(max-width:\s*820px\)[\s\S]*?\.mobile-dock\s*\{[\s\S]*?position:\s*fixed/);
assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)/);
assert.match(styles, /\.queueproof-logo[\s\S]*?opacity:\s*1/);

console.log("PASS  live shell, seven-destination navigation, nine direct judge routes, ungated public access, proof-first layout, timeline, comparison, replay, citations, dialogs, and result-state contracts");
