import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { gradeGroundedAnswer } from "../evals/lib/grounded-grader.mjs";

const readArg = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
};

const parseMcpResponse = (body) => {
  try {
    return JSON.parse(body);
  } catch {
    const dataLines = body
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .filter(Boolean);
    assert.ok(dataLines.length > 0, "MCP response was neither JSON nor an SSE data event.");
    return JSON.parse(dataLines.at(-1));
  }
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
  "grounded-grader-v3",
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

const runPublicAsk = async (question) => {
  const response = await fetch(`${base}/api/ask`, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ question, mode: "auto" }),
  });
  assert.equal(response.status, 200, `Public web ask failed for "${question}".`);
  const body = await response.json();
  assert.equal(body.ok, true, `Public web ask did not return ok=true for "${question}".`);
  return body;
};

const assertWebEvidenceClosure = (result, label) => {
  assert.ok(Array.isArray(result.claims), `${label} is missing claims.`);
  assert.ok(Array.isArray(result.citations), `${label} is missing citations.`);
  assert.ok(Array.isArray(result.contradictions), `${label} is missing contradictions.`);
  assert.ok(Array.isArray(result.evidence), `${label} is missing evidence.`);
  const referencedIds = new Set([
    ...result.claims.flatMap((claim) => claim.citation_ids ?? []),
    ...result.contradictions.flatMap((contradiction) => contradiction.evidenceIds ?? []),
  ]);
  const evidenceIds = new Set(result.evidence.map((item) => item.id));
  const citationIds = new Set(result.citations.map((item) => item.id));
  assert.deepEqual([...evidenceIds].sort(), [...referencedIds].sort(),
    `${label} returned uncited or otherwise unreferenced evidence.`);
  assert.deepEqual([...citationIds].sort(), [...referencedIds].sort(),
    `${label} citations do not close over every claim and contradiction receipt.`);
  assert.equal(result.validation?.evidenceCount, result.evidence.length,
    `${label} validation evidence count does not match the returned evidence.`);
  assert.equal(result.retrieval_receipt?.receipt_count, result.citations.length,
    `${label} receipt count does not match its citations.`);
  const providers = [...new Set(result.evidence.map((item) => item.provider))].sort();
  assert.deepEqual([...(result.validation?.providerCoverage ?? [])].sort(), providers,
    `${label} validation provider coverage does not match the returned evidence.`);
  assert.deepEqual([...(result.retrieval_receipt?.provider_coverage ?? [])].sort(), providers,
    `${label} receipt provider coverage does not match the returned evidence.`);
};

const webFlagship = await runPublicAsk(
  "Who escalated the AuthShield outage, what did engineering commit to, and is the fix already merged?",
);
assertWebEvidenceClosure(webFlagship, "Web flagship answer");
assert.equal(webFlagship.claims.length, 4,
  `Web flagship returned ${webFlagship.claims.length} claims; expected exactly 4.`);
assert.equal(webFlagship.citations.length, 4,
  `Web flagship returned ${webFlagship.citations.length} citations; expected exactly 4.`);
assert.equal(webFlagship.evidence.length, 4,
  `Web flagship returned ${webFlagship.evidence.length} receipts; expected exactly 4.`);
assert.equal(webFlagship.trace?.callCount, 1,
  `Web flagship used ${webFlagship.trace?.callCount} HydraDB calls; expected exactly 1.`);
assert.deepEqual(
  [...new Set(webFlagship.evidence.map((item) => item.provider))].sort(),
  ["github", "linear", "slack"],
  "Web flagship must close over exactly Linear, GitHub, and Slack.",
);
assert.doesNotMatch(
  JSON.stringify(webFlagship.evidence),
  /\b(?:TypeScript|ESLint|Vitest|Webpack|Vinext)\b|\b\d+\s+tests?\s+passed\b|\b(?:exact preview|benchmark artifact|secret scans?|diff whitespace check)\b|\/api\/health\/live\b|\bdeployment:\s*(?:dpl_|https:\/\/)\S*|\b(?:production|preview)\s+build\s+passed\b/i,
  "The web flagship retained QueueProof CI or release-note noise.",
);

const webDeadlineConflict = await runPublicAsk(
  "Which sources disagree about the billing migration deadline?",
);
assertWebEvidenceClosure(webDeadlineConflict, "Web deadline-conflict answer");
assert.equal(webDeadlineConflict.trace?.callCount, 1,
  `Web deadline-conflict lookup used ${webDeadlineConflict.trace?.callCount} HydraDB calls; expected exactly 1.`);
assert.equal(webDeadlineConflict.claims.length, 2,
  `Web deadline-conflict answer returned ${webDeadlineConflict.claims.length} claims; expected exactly 2.`);
assert.equal(webDeadlineConflict.citations.length, 2,
  `Web deadline-conflict answer returned ${webDeadlineConflict.citations.length} citations; expected exactly 2.`);
assert.equal(webDeadlineConflict.evidence.length, 2,
  `Web deadline-conflict answer returned ${webDeadlineConflict.evidence.length} receipts; expected exactly 2.`);
assert.deepEqual(
  [...new Set(webDeadlineConflict.evidence.map((item) => item.provider))].sort(),
  ["linear", "slack"],
  "Web deadline-conflict proof must close over exactly Linear and Slack.",
);
assert.equal(webDeadlineConflict.contradictions.length, 1,
  `Web deadline-conflict answer returned ${webDeadlineConflict.contradictions.length} contradictions; expected exactly 1.`);
const deadlineContradictionIds = webDeadlineConflict.contradictions[0]?.evidenceIds ?? [];
assert.equal(deadlineContradictionIds.length, 2,
  "Web deadline-conflict contradiction must cite exactly two receipts.");
const deadlineEvidenceById = new Map(webDeadlineConflict.evidence.map((item) => [item.id, item]));
assert.deepEqual(
  [...new Set(deadlineContradictionIds.map((id) => deadlineEvidenceById.get(id)?.provider).filter(Boolean))].sort(),
  ["linear", "slack"],
  "Web deadline-conflict contradiction must resolve to both Linear and Slack receipts.",
);
const deadlineGrade = gradeGroundedAnswer({
  answer: webDeadlineConflict.answer,
  claims: webDeadlineConflict.claims,
  citations: webDeadlineConflict.citations,
  contradictions: webDeadlineConflict.contradictions,
  providerCoverage: webDeadlineConflict.evidence.map((item) => item.provider),
  requiredFacts: [
    { id: "subject", anyOf: ["billing migration"] },
    { id: "first-deadline", anyOf: ["7 August"] },
    { id: "second-deadline", anyOf: ["14 August"] },
  ],
  requiredProviders: ["linear", "slack"],
  requiresContradiction: true,
});
assert.equal(deadlineGrade.pass, true,
  `Web deadline-conflict answer failed grounded-grader-v3: ${JSON.stringify({
    missingFacts: deadlineGrade.missingFacts,
    missingProviders: deadlineGrade.missingProviders,
    irrelevantClaims: deadlineGrade.irrelevantClaims,
    contradictionPass: deadlineGrade.contradictionPass,
  })}`);
assert.deepEqual(deadlineGrade.supportedProviders, ["linear", "slack"],
  "Web deadline-conflict v3 grade must be supported by exactly Linear and Slack.");
assert.doesNotMatch(
  JSON.stringify(webDeadlineConflict),
  /medical billing|healthcare systems?|phantom service|blockchain in healthcare|\\"provider\\":\\"gmail\\"/i,
  "Web deadline-conflict answer retained unrelated medical-billing evidence.",
);

const webExactId = await runPublicAsk("What is BUG-123?");
assertWebEvidenceClosure(webExactId, "Web exact-ID answer");
assert.equal(webExactId.trace?.mode, "fast", "A bare web exact-ID lookup must stay in Fast mode.");
assert.equal(webExactId.trace?.callCount, 1,
  `Web exact-ID lookup used ${webExactId.trace?.callCount} HydraDB calls; expected exactly 1.`);
assert.equal(webExactId.claims.length, 1,
  `Web exact-ID lookup returned ${webExactId.claims.length} claims; expected exactly 1.`);
assert.equal(webExactId.citations.length, 1,
  `Web exact-ID lookup returned ${webExactId.citations.length} citations; expected exactly 1.`);
assert.equal(webExactId.evidence.length, 1,
  `Web exact-ID lookup returned ${webExactId.evidence.length} receipts; expected exactly 1.`);
assert.equal(webExactId.contradictions.length, 0,
  "Web exact-ID lookup must not manufacture a contradiction.");
assert.equal(webExactId.priority_items?.length, 0,
  "Web exact-ID lookup must not attach an unrelated action.");
assert.equal(webExactId.evidence[0]?.provider, "slack",
  "The reviewed BUG-123 web receipt must come from Slack.");
assert.match(
  `${webExactId.evidence[0]?.id ?? ""} ${webExactId.evidence[0]?.title ?? ""} ${webExactId.evidence[0]?.excerpt ?? ""}`,
  /\bBUG-123\b/i,
  "Web exact-ID lookup did not retain the exact BUG-123 receipt.",
);
assert.doesNotMatch(JSON.stringify(webExactId), /\bBUG-1234\b|\bENG-456\b/i,
  "Web exact-ID lookup retained a neighboring or unrelated record.");

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

const demoSearchResponse = await fetch(`${base}/mcp/demo`, {
  method: "POST",
  headers: {
    accept: "application/json, text/event-stream",
    "content-type": "application/json",
  },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "queueproof_search",
      arguments: {
        query: "Who escalated the AuthShield outage, what did engineering commit to, and is the fix already merged?",
        mode: "auto",
      },
    },
  }),
});
assert.equal(demoSearchResponse.status, 200, "The public MCP demo search must return 200.");
const demoSearchRpc = parseMcpResponse(await demoSearchResponse.text());
assert.ifError(demoSearchRpc.error);
const demoSearch = demoSearchRpc.result?.structuredContent;
assert.equal(typeof demoSearch?.answer, "string", "MCP search is missing its grounded answer.");
assert.doesNotMatch(demoSearch.answer, /^Insufficient evidence\b/,
  "The reviewed flagship query unexpectedly abstained.");
assert.ok(Array.isArray(demoSearch.claims) && demoSearch.claims.length > 0,
  "MCP search must return at least one grounded claim.");
assert.ok(Array.isArray(demoSearch.citations) && demoSearch.citations.length > 0,
  "MCP search must return citation objects for grounded claims.");
assert.ok(Number.isFinite(demoSearch.estimatedCostUnits) && demoSearch.estimatedCostUnits > 0,
  "MCP search must report positive relative retrieval cost.");
assert.ok(Array.isArray(demoSearch.contradictions),
  "MCP search must return an explicit contradictions array.");
assert.ok(Array.isArray(demoSearch.missingInformation),
  "MCP search must return an explicit missing-information array.");
assert.ok(["grounded", "partial"].includes(demoSearch.validation?.status),
  "MCP search validation must be grounded or explicitly partial.");
assert.equal(demoSearch.validation?.claimCount, demoSearch.claims.length,
  "MCP validation claim count does not match the returned claims.");
assert.equal(demoSearch.validation?.citedClaimCount, demoSearch.claims.length,
  "Every returned MCP claim must be cited.");
assert.equal(demoSearch.validation?.evidenceCount, demoSearch.evidence?.length,
  "MCP validation evidence count does not match the returned evidence.");
const demoEvidenceIds = new Set((demoSearch.evidence ?? []).map((item) => item.evidenceId));
for (const citation of demoSearch.citations) {
  assert.ok(demoEvidenceIds.has(citation.evidenceId),
    `MCP citation references missing evidence ${citation.evidenceId}.`);
}
for (const item of [...demoSearch.claims, ...demoSearch.contradictions]) {
  assert.ok(Array.isArray(item.evidenceIds) && item.evidenceIds.length > 0,
    "Every claim and contradiction must reference returned evidence.");
  for (const evidenceId of item.evidenceIds) {
    assert.ok(demoEvidenceIds.has(evidenceId),
      `MCP result references missing evidence ${evidenceId}.`);
  }
}
const referencedEvidenceIds = new Set(
  [...demoSearch.claims, ...demoSearch.contradictions]
    .flatMap((item) => item.evidenceIds),
);
const citationEvidenceIds = new Set(
  demoSearch.citations.map((citation) => citation.evidenceId),
);
assert.deepEqual(
  [...demoEvidenceIds].sort(),
  [...referencedEvidenceIds].sort(),
  "MCP search returned an uncited or otherwise unreferenced evidence receipt.",
);
assert.deepEqual(
  [...citationEvidenceIds].sort(),
  [...referencedEvidenceIds].sort(),
  "MCP citations must close over every returned claim and contradiction receipt.",
);
const returnedProviders = [...new Set(
  demoSearch.evidence.map((item) => item.provider),
)].sort();
assert.deepEqual(
  [...demoSearch.providerCoverage].sort(),
  returnedProviders,
  "MCP provider coverage must describe the returned evidence exactly.",
);
assert.doesNotMatch(
  JSON.stringify(demoSearch.evidence),
  /\b\d+\s+tests?\s+passed\b|\/api\/health\/live|\bexact preview\b|\bbenchmark artifact\b/i,
  "The synthetic demo answer retained QueueProof CI or release-note noise.",
);

const exactIdResponse = await fetch(`${base}/mcp/demo`, {
  method: "POST",
  headers: {
    accept: "application/json, text/event-stream",
    "content-type": "application/json",
  },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "queueproof_search",
      arguments: { query: "What is BUG-123?", mode: "auto" },
    },
  }),
});
assert.equal(exactIdResponse.status, 200, "The public MCP exact-ID search must return 200.");
const exactIdRpc = parseMcpResponse(await exactIdResponse.text());
assert.ifError(exactIdRpc.error);
const exactIdSearch = exactIdRpc.result?.structuredContent;
assert.equal(exactIdSearch?.mode, "fast", "A single exact-ID lookup must stay in Fast mode.");
assert.ok(exactIdSearch?.callCount <= 2,
  `Exact-ID search used ${exactIdSearch?.callCount} HydraDB calls; expected at most 2.`);
assert.ok(Array.isArray(exactIdSearch?.evidence) && exactIdSearch.evidence.length > 0 &&
  exactIdSearch.evidence.length <= 6,
"Exact-ID search must retain between 1 and 6 receipts.");
for (const item of exactIdSearch.evidence) {
  assert.match(`${item.sourceId ?? ""} ${item.title ?? ""} ${item.excerpt ?? ""}`, /\bBUG-123\b/i,
    "Exact-ID search retained an unrelated or neighboring receipt.");
}

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
