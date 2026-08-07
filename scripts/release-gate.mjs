import assert from "node:assert/strict";
import { createHash } from "node:crypto";

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
assert.equal(health.status, "live", "Live health endpoint must report status=live.");
assert.ok(health.release?.commitSha, "Live health endpoint must report a commit SHA.");
assert.equal(health.release.commitSha, intendedSha, "Deployed SHA does not match the intended release SHA.");
assert.ok(
  typeof health.release.commitRef === "string" && health.release.commitRef.trim(),
  "Live health endpoint must report a non-empty release ref.",
);
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

const workspaceResponse = await fetch(`${base}/api/workspace`, {
  headers: { accept: "application/json", "cache-control": "no-store" },
});
assert.equal(workspaceResponse.status, 200, "Anonymous public workspace state must return 200.");
const workspaceBody = await workspaceResponse.json();
assert.equal(workspaceBody.view?.kind, "ready", "The configured public workspace is not ready.");
assert.equal(workspaceBody.view?.actor?.publicAccess, true, "Anonymous traffic did not resolve to the public actor.");
const publicWorkspaceReference = workspaceBody.view?.workspace?.id;
assert.match(publicWorkspaceReference ?? "", /^public-workspace-[a-f0-9]{32}$/,
  "The anonymous DTO must expose only an opaque public workspace handle.");
const expectedPublicWorkspace = readArg("--workspace") || process.env.QUEUEPROOF_PUBLIC_WORKSPACE_ID || "";
if (expectedPublicWorkspace) {
  const digest = createHash("sha256")
    .update(`queueproof-public-reference:${expectedPublicWorkspace}:workspace:${expectedPublicWorkspace}`)
    .digest("hex");
  assert.equal(
    publicWorkspaceReference,
    `public-workspace-${digest.slice(0, 32)}`,
    "Production resolved a different public workspace than the reviewed selector.",
  );
}
const verifiedConnectors = (workspaceBody.view?.evidence?.connectors ?? [])
  .filter((connector) => connector.state === "data_verified");
assert.ok(verifiedConnectors.length >= 3,
  `The public judge workspace has ${verifiedConnectors.length} verified connector(s); at least three are required.`);
const indexedDocuments = (workspaceBody.view?.evidence?.documents ?? [])
  .filter((document) => document.stage === "indexed" && document.sourceReceiptPresent === true);
assert.ok(indexedDocuments.length >= 1,
  "The public judge workspace needs at least one indexed document with a HydraDB source receipt.");

const routes = [
  "/", "/queue", "/evidence", "/benchmarks", "/replay", "/approvals",
  "/developer", "/method", "/demo", "/owner", "/sign-in", "/support",
  "/privacy", "/terms", "/this-route-must-not-exist",
];
for (const path of routes) {
  const response = await fetch(`${base}${path}`, { headers: { accept: "text/html" } });
  assert.equal(response.status, path === "/this-route-must-not-exist" ? 404 : 200, `${path} returned ${response.status}.`);
  const html = await response.text();
  assert.match(html, /QueueProof/i, `${path} did not render the QueueProof application.`);
  if (path === "/") assert.match(html, /ember-assistant-v1/, "Production is missing the Ember assistant design-system marker.");
  if (path === "/this-route-must-not-exist") assert.match(html, /This route left no receipt\./, "Production is missing the branded 404.");
}

const assets = [
  "/queueproof-favicon-v2.svg",
  "/queueproof-favicon-v2-32.png",
  "/queueproof-favicon-v2.ico",
  "/queueproof-apple-touch-icon-v2.png",
  "/queueproof-icon-v2-192.png",
  "/queueproof-icon-v2-512.png",
];
for (const path of assets) {
  const response = await fetch(`${base}${path}`, { headers: { accept: "*/*" } });
  assert.equal(response.status, 200, `${path} returned ${response.status}.`);
  const bytes = await response.arrayBuffer();
  assert.ok(bytes.byteLength > 100, `${path} is unexpectedly empty.`);
}

const manifestResponse = await fetch(`${base}/manifest.webmanifest`, {
  headers: { accept: "application/manifest+json, application/json" },
});
assert.equal(manifestResponse.status, 200, "Web app manifest must return 200.");
const manifest = await manifestResponse.json();
assert.equal(manifest.name, "QueueProof", "Web app manifest must use the QueueProof name.");
const manifestIcons = new Set((manifest.icons ?? []).map((icon) => icon.src));
assert.ok(manifestIcons.has("/queueproof-icon-v2-192.png"), "Manifest is missing the 192px QueueProof icon.");
assert.ok(manifestIcons.has("/queueproof-icon-v2-512.png"), "Manifest is missing the 512px QueueProof icon.");

const metadataResponse = await fetch(`${base}/.well-known/oauth-protected-resource/mcp`, {
  headers: { accept: "application/json" },
});
assert.equal(metadataResponse.status, 200, "MCP protected-resource metadata must return 200.");
const metadata = await metadataResponse.json();
assert.equal(metadata.resource, `${base}/mcp`, "MCP metadata must bind the canonical resource exactly.");
assert.ok(Array.isArray(metadata.authorization_servers) && metadata.authorization_servers.length === 1,
  "MCP metadata must advertise exactly one authorization server.");
// Supabase advertises standard identity scopes. QueueProof maps a verified OAuth
// identity to its internal read permission; write/sync permissions are deliberately
// not requestable through this public OAuth grant.
for (const scope of ["openid", "profile", "email"]) {
  assert.ok(metadata.scopes_supported?.includes(scope), `MCP metadata is missing ${scope}.`);
}
for (const internalScope of ["queueproof:propose", "queueproof:sync"]) {
  assert.ok(!metadata.scopes_supported?.includes(internalScope),
    `MCP metadata must not advertise internal ${internalScope} through Supabase OAuth.`);
}

for (const path of ["/mcp", "/api/mcp"]) {
  const response = await fetch(`${base}${path}`, { headers: { accept: "application/json" } });
  assert.equal(response.status, 401, `Anonymous ${path} must return 401.`);
  assert.match(response.headers.get("www-authenticate") ?? "", /^Bearer\b/, `${path} is missing a Bearer challenge.`);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/i, `${path} auth failures must not be cached.`);
  assert.deepEqual(await response.json(), { error: "invalid_token" }, `${path} returned an unexpected auth body.`);
}

const demoMcpResponse = await fetch(`${base}/mcp/demo`, {
  method: "POST",
  headers: {
    accept: "application/json, text/event-stream",
    "content-type": "application/json",
  },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
});
assert.equal(demoMcpResponse.status, 200, "The read-only public MCP demo must return 200.");
const demoMcpBody = await demoMcpResponse.text();
assert.match(demoMcpBody, /queueproof_search/, "The public MCP demo is missing its search tool.");
assert.match(demoMcpBody, /\"type\":\"noauth\"/, "Public MCP tools must advertise noauth.");
assert.doesNotMatch(demoMcpBody, /\"type\":\"oauth2\"/, "Public MCP tools must not claim OAuth.");
for (const unavailableTool of [
  "queueproof_health",
  "queueproof_list_connectors",
  "queueproof_list_documents",
  "queueproof_verify_connector",
  "queueproof_get_next_actions",
  "queueproof_get_execution_packet",
  "queueproof_explain_priority",
  "queueproof_compare_priorities",
  "queueproof_list_queue_snapshots",
  "queueproof_get_action_status",
  "queueproof_sync_connector",
  "queueproof_propose_action",
  "queueproof_report_execution_result",
]) {
  assert.doesNotMatch(demoMcpBody, new RegExp(unavailableTool),
    `The public MCP demo exposed ${unavailableTool}.`);
}

const demoResourceResponse = await fetch(`${base}/mcp/demo`, {
  method: "POST",
  headers: {
    accept: "application/json, text/event-stream",
    "content-type": "application/json",
  },
  body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "resources/list", params: {} }),
});
assert.equal(demoResourceResponse.status, 200, "The public MCP demo resource list must return 200.");
const demoResourceBody = await demoResourceResponse.text();
assert.match(demoResourceBody, /queueproof:\/\/demo\/guide/,
  "The public MCP demo is missing its safe routing guide.");
assert.doesNotMatch(demoResourceBody, /workspaceId|database|collection|connectorId|sourceId/i,
  "The public MCP demo guide exposed an internal identifier.");

const challengeResponse = await fetch(`${base}/.well-known/openai-apps-challenge`, {
  headers: { accept: "text/plain" },
});
assert.ok([200, 404].includes(challengeResponse.status),
  `OpenAI challenge endpoint returned unexpected HTTP ${challengeResponse.status}.`);
if (challengeResponse.status === 200) {
  assert.match(await challengeResponse.text(), /^[\u0021-\u007e]{8,2048}$/,
    "Configured OpenAI challenge token is malformed.");
}
console.log(
  `PASS  production ${intendedSha} (${health.release.deploymentId}) serves the ember-assistant-v1 marker, ` +
  "binds /api/lab to the same release, serves the full public route/icon surface, enforces MCP OAuth, verifies the read-only public MCP demo, and returns the branded 404",
);
