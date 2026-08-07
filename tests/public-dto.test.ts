import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireDb } from "../lib/server/runtime";
import { createId, ensureCoreSchema } from "../lib/server/store";
import {
  publicDtoForActor,
  publicQueryReference,
  publicWebUrl,
} from "../lib/server/public-dto";
import type { RequestActor } from "../lib/server/identity";

const publicActor: RequestActor = {
  id: "user:public-access",
  email: "public@queueproof.local",
  displayName: "Public workspace",
  localDevelopment: false,
  authType: "public",
};
const privateActor: RequestActor = {
  id: "user:private-owner",
  email: "owner@example.invalid",
  displayName: "Private owner",
  localDevelopment: false,
  authType: "legacy",
};

const secrets = {
  workspace: "ws_public_dto_secret",
  connector: "connector_public_dto_secret",
  hydraConnector: "hydra_connector_public_dto_secret",
  database: "database_public_dto_secret",
  collection: "collection_public_dto_secret",
  source: "source_public_dto_secret",
  external: "external_public_dto_secret",
  document: "document_public_dto_secret",
  contentHash: "content_hash_public_dto_secret",
  packet: "packet_public_dto_secret",
  task: "task_public_dto_secret",
  query: "query_public_dto_secret",
  error: "RAW_PROVIDER_ERROR_PUBLIC_DTO_SECRET",
  metadata: "ARBITRARY_METADATA_PUBLIC_DTO_SECRET",
};

const normaliseKey = (key: string) => key.replace(/[^a-z0-9]/gi, "").toLowerCase();
const forbiddenPublicKeys = new Set([
  "workspaceid", "database", "databases", "databaseid", "databaseids", "collection",
  "collections", "collectionid", "collectionids", "accountscope", "storageid", "storageids",
  "storagekey", "storagekeys", "fingerprint", "metadata", "metadatajson", "metadatafilters",
  "additionalmetadata", "lineagemetadatafilters", "externalid", "externalids", "requestid",
  "providerresponseid", "deduplicatedtasks", "error", "errors", "lasterror",
  "rawerror", "executionerror", "failurereason", "sha256", "sha1", "md5", "checksum",
  "digest", "etag",
]);

function assertPublicShape(value: unknown) {
  const visit = (entry: unknown) => {
    if (Array.isArray(entry)) {
      entry.forEach(visit);
      return;
    }
    if (!entry || typeof entry !== "object") return;
    for (const [key, child] of Object.entries(entry as Record<string, unknown>)) {
      const normalised = normaliseKey(key);
      expect(forbiddenPublicKeys.has(normalised), `public key ${key}`).toBe(false);
      expect(
        normalised.startsWith("hydra") && (
          normalised.endsWith("id") || normalised.endsWith("ids") ||
          normalised.endsWith("database") || normalised.endsWith("collection") ||
          normalised.endsWith("fingerprint") || normalised.endsWith("key")
        ),
        `public HydraDB identifier key ${key}`,
      ).toBe(false);
      expect(normalised.includes("hash"), `public hash key ${key}`).toBe(false);
      if (normalised.endsWith("url") || normalised === "href" || normalised === "permalink") {
        expect(child === null || (typeof child === "string" && /^https?:\/\//.test(child))).toBe(true);
      }
      visit(child);
    }
  };
  visit(value);
  const serialised = JSON.stringify(value);
  for (const secret of Object.values(secrets)) expect(serialised).not.toContain(secret);
}

function packet() {
  return {
    packet_id: secrets.packet,
    workspace_id: secrets.workspace,
    created_at: "2026-08-07T10:00:00.000Z",
    policy_version: "queueproof-default-2.0.0",
    task: {
      title: "Review the AuthShield fix",
      objective: "Confirm the cited fix before any provider write.",
      owner: "Amina",
      project: "AuthShield",
      deadline: null,
      priority_score: 82,
      confidence: 0.91,
    },
    why_now: ["Customer impact is active."],
    constraints: ["Keep approval required."],
    dependencies: [],
    acceptance_criteria: ["Confirm the cited receipt."],
    evidence: [{
      sourceId: secrets.source,
      provider: "slack",
      externalId: secrets.external,
      title: "Incident update",
      excerpt: "Engineering says the fix is ready for review.",
      timestamp: "2026-08-07T09:30:00.000Z",
      ingestionTimestamp: "2026-08-07T09:31:00.000Z",
      url: "mailto:private@example.invalid",
      authority: "primary",
      metadata: { arbitrary: secrets.metadata, database: secrets.database },
    }],
    contradictions: [{ summary: "One source still reports open work.", evidenceIds: [secrets.source], providers: ["slack"] }],
    missing_information: [],
    score_breakdown: { urgency: 18 },
    penalties: {},
    active_formula: "deterministic-v2",
    recommended_safe_action: "Review the cited receipt before proposing a change.",
    provider_coverage: ["slack"],
    deduplicated_tasks: [`slack:${secrets.external}`],
    status: "open",
    recommended_agent: "human",
    permissions: { read: ["slack"], write: [], approval_required: true },
    completion_callback: { type: "mcp_tool", tool: "queueproof_report_execution_result" },
    receipt_hash: secrets.contentHash,
  };
}

function workflow() {
  const provider = {
    provider: "slack",
    connectorId: secrets.connector,
    status: "received",
    receiptCount: 1,
    latencyMs: 42,
    evidenceIds: [secrets.source],
  };
  const priority = {
    id: secrets.task,
    title: "Review the AuthShield fix",
    normalized_entity: "AuthShield",
    owner: "Amina",
    due_date: null,
    status: "open",
    score: 82,
    score_breakdown: { urgency: 18 },
    penalties: {},
    why_now: ["Customer impact is active."],
    recommended_next_safe_action: "Review the cited receipt.",
    evidence_ids: [secrets.source],
    disagreements: [],
    confidence: 0.91,
    provider_coverage: ["slack"],
    deduplicated_tasks: [`slack:${secrets.external}`],
    approval_required: true,
  };
  return {
    schemaVersion: "live-proof-v1",
    kind: "verified-backend-receipt",
    queryId: secrets.query,
    stage: "complete",
    mode: "fast",
    routingReason: "Exact identifier lookup",
    providers: [provider],
    graph: {
      nodes: [
        { id: `provider:slack`, type: "provider", label: "slack", provider: "slack" },
        { id: `evidence:${secrets.source}`, type: "evidence", label: "Incident update", provider: "slack" },
        { id: "claim:1", type: "claim", label: "The fix is ready." },
      ],
      edges: [{ id: `supports:${secrets.source}:claim:1`, source: `evidence:${secrets.source}`, target: "claim:1", type: "supports" }],
    },
    claims: [{ text: "The fix is ready.", citation_ids: [secrets.source], providers: ["slack"] }],
    contradictions: [{ summary: "One source still reports open work.", evidenceIds: [secrets.source], providers: ["slack"] }],
    priorityItems: [priority],
    events: [{
      sequence: 1,
      stage: "complete",
      recordedAt: "2026-08-07T10:00:00.000Z",
      detail: "Grounded answer finalized.",
      providers: [provider],
      receiptCount: 1,
      callCount: 1,
    }],
    receipt: {
      query_id: secrets.query,
      hydradb_mode: "fast",
      routing_reason: "Exact identifier lookup",
      hydradb_call_count: 1,
      total_latency_ms: 42,
      provider_coverage: ["slack"],
      receipt_count: 1,
      metadata_filters: { database: secrets.database, arbitrary: secrets.metadata },
      graph_usage: true,
      estimated_cost_units: 1,
      timestamp: "2026-08-07T10:00:00.000Z",
    },
    persisted: true,
    replayAvailable: true,
    error: { code: "legacy_raw", message: secrets.error, retryable: false },
  };
}

function storedResult() {
  return {
    question: "Is the AuthShield fix ready?",
    answer: "The cited update says it is ready for review.",
    citations: [{
      id: secrets.source,
      sourceId: secrets.source,
      connectorId: secrets.connector,
      externalId: secrets.external,
      provider: "slack",
      title: "Incident update",
      excerpt: "Engineering says the fix is ready for review.",
      timestamp: "2026-08-07T09:30:00.000Z",
      url: "javascript:alert(1)",
      metadata: { arbitrary: secrets.metadata },
    }],
    evidence: [{
      id: secrets.source,
      sourceId: secrets.source,
      connectorId: secrets.connector,
      provider: "slack",
      title: "Incident update",
      excerpt: "Engineering says the fix is ready for review.",
      url: "https://example.com/proof",
    }],
    claims: [{ text: "The fix is ready.", citation_ids: [secrets.source], providers: ["slack"] }],
    contradictions: [{ summary: "One source still reports open work.", evidenceIds: [secrets.source], providers: ["slack"] }],
    priority_items: [],
    missing_information: [],
    retrieval_receipt: workflow().receipt,
    routing_reason: "Exact identifier lookup",
    workflow: workflow(),
    validation: { status: "grounded", claimCount: 1, citedClaimCount: 1, evidenceCount: 1, providerCoverage: ["slack"] },
    trace: {
      runId: secrets.query,
      calls: [{ connectorIds: [secrets.connector], sourceIds: [secrets.source], database: secrets.database, collection: secrets.collection, error: secrets.error }],
      metadataFilters: { arbitrary: secrets.metadata },
    },
    rawError: secrets.error,
  };
}

async function seedPublicInventory() {
  const db = requireDb();
  const rankingRunId = "ranking_public_dto_secret";
  const verificationId = "verification_public_dto_secret";
  const resourceId = "resource_public_dto_secret";
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO users (id, email, display_name) VALUES (?, ?, ?)")
      .bind(publicActor.id, publicActor.email, publicActor.displayName),
    db.prepare("INSERT OR IGNORE INTO workspaces (id, slug, name) VALUES (?, ?, ?)")
      .bind(secrets.workspace, "public-dto", "Public proof workspace"),
    db.prepare("INSERT OR IGNORE INTO workspace_members (id, workspace_id, user_id, role) VALUES (?, ?, ?, 'member')")
      .bind(createId("member"), secrets.workspace, publicActor.id),
    db.prepare(
      `INSERT OR IGNORE INTO connectors
       (id, workspace_id, hydradb_connector_id, provider, name, account_scope, database, collection,
        state, last_successful_sync_at, last_error)
       VALUES (?, ?, ?, 'slack', 'Incident Slack', 'private-account', ?, ?, 'data_verified', ?, ?)`,
    ).bind(
      secrets.connector, secrets.workspace, secrets.hydraConnector, secrets.database, secrets.collection,
      "2026-08-07T09:00:00.000Z", secrets.error,
    ),
    db.prepare(
      `INSERT OR IGNORE INTO connector_resources
       (id, workspace_id, connector_id, external_resource_id, resource_type, display_name,
        selected, status, provider_cursor_hash, last_synced_at, metadata_json)
       VALUES (?, ?, ?, ?, 'channel', 'Incident room', 1, 'verified', ?, ?, ?)`,
    ).bind(
      resourceId, secrets.workspace, secrets.connector, "external-resource-secret",
      secrets.contentHash, "2026-08-07T09:00:00.000Z", JSON.stringify({ arbitrary: secrets.metadata }),
    ),
    db.prepare(
      `INSERT OR IGNORE INTO connection_verifications
       (id, workspace_id, connector_id, provider, account_scope, resource_ids_json,
        verification_stage, last_successful_sync, cursor_evidence_hash, canary_query_hash,
        canary_result_count, source_ids_json, provider_coverage_json, verified_at, failure_reason)
       VALUES (?, ?, ?, 'slack', 'private-account', ?, 'data_verified', ?, ?, ?, 3, ?, '["slack"]', ?, ?)`,
    ).bind(
      verificationId, secrets.workspace, secrets.connector, JSON.stringify(["external-resource-secret"]),
      "2026-08-07T09:00:00.000Z", secrets.contentHash, secrets.contentHash,
      JSON.stringify([secrets.source]), "2026-08-07T09:00:00.000Z", secrets.error,
    ),
    db.prepare(
      `INSERT OR IGNORE INTO documents
       (id, workspace_id, filename, mime, byte_size, content_hash, hydradb_database,
        hydradb_source_id, stage, error, page_count, indexed_at, processing_duration_ms)
       VALUES (?, ?, 'incident.pdf', 'application/pdf', 4096, ?, ?, ?, 'indexed', ?, 3, ?, 900)`,
    ).bind(
      secrets.document, secrets.workspace, secrets.contentHash, secrets.database, secrets.source,
      secrets.error, "2026-08-07T09:00:00.000Z",
    ),
    db.prepare(
      `INSERT OR IGNORE INTO source_references
       (id, workspace_id, provider, connector_id, external_id, title, excerpt, source_url,
        source_timestamp, authority, content_hash, metadata_json)
       VALUES (?, ?, 'slack', ?, ?, 'Incident update', 'The fix is ready for review.',
        'file:///private/provider/path', ?, 'primary', ?, ?)`,
    ).bind(
      secrets.source, secrets.workspace, secrets.connector, secrets.external,
      "2026-08-07T09:30:00.000Z", secrets.contentHash, JSON.stringify({ arbitrary: secrets.metadata }),
    ),
    db.prepare(
      `INSERT OR IGNORE INTO ranking_runs
       (id, workspace_id, policy_version, input_hash, started_at, completed_at)
       VALUES (?, ?, 'queueproof-default-2.0.0', ?, ?, ?)`,
    ).bind(rankingRunId, secrets.workspace, secrets.contentHash, "2026-08-07T10:00:00.000Z", "2026-08-07T10:00:00.000Z"),
    db.prepare(
      `INSERT OR IGNORE INTO task_candidates
       (id, workspace_id, title, recommended_action, owner, project, customer, deadline,
        status, attributes_json, confidence)
       VALUES (?, ?, 'Review the AuthShield fix', 'Review the cited receipt.', 'Amina',
        'AuthShield', NULL, NULL, 'open', '{}', 91)`,
    ).bind(secrets.task, secrets.workspace),
    db.prepare(
      `INSERT OR IGNORE INTO ranking_items
       (id, workspace_id, ranking_run_id, task_id, rank, component_scores_json,
        penalties_json, final_score, confidence, explanation_json, sensitivity_json)
       VALUES (?, ?, ?, ?, 1, '{"urgency":18}', '{}', 82, 91, '[]', '{}')`,
    ).bind("rank_item_public_dto_secret", secrets.workspace, rankingRunId, secrets.task),
    db.prepare(
      `INSERT OR IGNORE INTO execution_packets
       (id, workspace_id, task_id, policy_version, packet_json, status)
       VALUES (?, ?, ?, 'queueproof-default-2.0.0', ?, 'available')`,
    ).bind(secrets.packet, secrets.workspace, secrets.task, JSON.stringify(packet())),
    db.prepare(
      `INSERT OR IGNORE INTO query_runs
       (id, workspace_id, actor_id, category, sanitised_query, mode, plan_json,
        provider_coverage_json, source_count, call_count, latency_ms, status, error_type)
       VALUES (?, ?, ?, 'exact_id', 'Is the fix ready?', 'fast', '{}', '["slack"]', 1, 1, 42, 'complete', NULL)`,
    ).bind(secrets.query, secrets.workspace, publicActor.id),
    db.prepare(
      `INSERT OR IGNORE INTO query_receipts
       (id, workspace_id, query_run_id, schema_version, receipt_json, receipt_hash)
       VALUES (?, ?, ?, 'live-proof-v1', ?, ?)`,
    ).bind(
      "receipt_public_dto_secret", secrets.workspace, secrets.query,
      JSON.stringify({ workflow: workflow(), result: storedResult() }), secrets.contentHash,
    ),
  ]);
}

describe("public DTO projector", () => {
  it("keeps private DTOs exactly intact and sanitises the anonymous projection", async () => {
    const raw = {
      workspace_id: secrets.workspace,
      id: secrets.document,
      connectorId: secrets.connector,
      hydradbSourceId: secrets.source,
      hydraSourceId: secrets.source,
      database: secrets.database,
      databaseId: secrets.database,
      collection: secrets.collection,
      collectionId: secrets.collection,
      storageId: "storage_public_dto_secret",
      contentHash: secrets.contentHash,
      error: secrets.error,
      metadata: { arbitrary: secrets.metadata },
      title: "Curated proof title",
      excerpt: "Curated proof excerpt",
      url: "mailto:private@example.invalid",
      related: { id: secrets.document, url: "https://example.com/proof" },
    };
    expect(publicDtoForActor(privateActor, raw)).toBe(raw);

    const publicReference = await publicQueryReference(secrets.workspace, secrets.query);
    const projected = publicDtoForActor(publicActor, raw, {
      referenceAliases: [{ raw: secrets.document, public: publicReference }],
    });
    assertPublicShape(projected);
    expect(projected).toEqual(expect.objectContaining({
      id: publicReference,
      title: "Curated proof title",
      excerpt: "Curated proof excerpt",
      url: null,
      related: expect.objectContaining({ url: null }),
    }));
  });

  it("does not expose provider links at the anonymous boundary", () => {
    expect(publicWebUrl("https://example.com/proof?q=1")).toBeNull();
    expect(publicWebUrl("http://example.com/proof")).toBeNull();
    expect(publicWebUrl("javascript:alert(1)")).toBeNull();
    expect(publicWebUrl("file:///private/path")).toBeNull();
    expect(publicWebUrl("https://user:password@example.com/proof")).toBeNull();
  });

  it("redacts secrets inside legacy proof strings and nulls signed web links", () => {
    // Build scanner-shaped regression fixtures at runtime so the repository never
    // contains a token-looking test literal while the projector still sees the
    // exact legacy labels and prefix it must redact.
    const auth0ClientSecretLabel = ["AUTH0", "CLIENT", "SECRET"].join("_");
    const auth0SessionSecretLabel = ["AUTH0", "SECRET"].join("_");
    const vercelTokenLabel = ["VERCEL", "TOKEN"].join("_");
    const vercelTokenValue = ["vc", "p_", "legacy-vercel-token-value"].join("");
    const legacy = {
      title: "client_secret=legacy-client-secret-value",
      excerpt: "Authorization: Bearer legacy.bearer.token",
      nested: {
        api_key: "legacy-api-key-value",
        note: "token=legacy-inline-token-value",
        auth0: `${auth0ClientSecretLabel}=legacy-auth0-client-secret`,
        auth0Session: `${auth0SessionSecretLabel}=legacy-auth0-session-secret`,
        vercel: `${vercelTokenLabel}=${vercelTokenValue}`,
      },
      url: "https://storage.example.test/proof?X-Amz-Signature=private-signature&token=private-token",
      alternateUrl: "s3://private-bucket/private-key",
    };
    expect(publicDtoForActor(privateActor, legacy)).toBe(legacy);
    const projected = publicDtoForActor(publicActor, legacy, { workspaceId: secrets.workspace });
    const serialised = JSON.stringify(projected);
    expect(serialised).not.toContain("legacy-client-secret-value");
    expect(serialised).not.toContain("legacy.bearer.token");
    expect(serialised).not.toContain("legacy-api-key-value");
    expect(serialised).not.toContain("legacy-inline-token-value");
    expect(serialised).not.toContain("legacy-auth0-client-secret");
    expect(serialised).not.toContain("legacy-auth0-session-secret");
    expect(serialised).not.toContain(vercelTokenValue);
    expect(serialised).not.toContain("private-signature");
    expect(projected).toEqual(expect.objectContaining({ url: null, alternateUrl: null }));
  });
});

describe("anonymous public read inventory", () => {
  beforeAll(async () => {
    await ensureCoreSchema();
    await seedPublicInventory();
  });

  beforeEach(() => {
    vi.stubEnv("QUEUEPROOF_ENCRYPTION_KEY", "");
    vi.stubEnv("QUEUEPROOF_TRUSTED_IDENTITY_PROXY", "");
    vi.stubEnv("QUEUEPROOF_ALLOW_LOCAL_IDENTITY", "false");
    vi.stubEnv("QUEUEPROOF_PUBLIC_ACCESS", "true");
    vi.stubEnv("QUEUEPROOF_PUBLIC_WORKSPACE_ID", secrets.workspace);
    vi.stubEnv("AUTH0_CLIENT_ID", "");
    vi.stubEnv("AUTH0_CLIENT_SECRET", "");
    vi.stubEnv("AUTH0_DOMAIN", "");
    vi.stubEnv("AUTH0_SECRET", "");
  });

  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ["workspace", async () => (await import("../app/api/workspace/route")).GET()],
    ["queue", async () => (await import("../app/api/queue/route")).GET()],
    ["queue packet", async () => (await import("../app/api/queue/[id]/route")).GET(
      new Request(`https://queueproof.example/api/queue/${secrets.packet}`),
      { params: Promise.resolve({ id: secrets.packet }) },
    )],
    ["connectors", async () => (await import("../app/api/connectors/route")).GET()],
    ["connector proof", async () => (await import("../app/api/connectors/[id]/proof/route")).GET(
      new Request(`https://queueproof.example/api/connectors/${secrets.connector}/proof`),
      { params: Promise.resolve({ id: secrets.connector }) },
    )],
    ["documents", async () => (await import("../app/api/documents/route")).GET()],
    ["connector health", async () => (await import("../app/api/health/connectors/route")).GET()],
    ["benchmark lab", async () => {
      vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "aed027879150e3e324b54c5ec2194d4d715c501e");
      return (await import("../app/api/lab/route")).GET();
    }],
    ["graph", async () => (await import("../app/api/graph/route")).GET(
      new Request("https://queueproof.example/api/graph"),
    )],
    ["stored ask", async () => (await import("../app/api/ask/[id]/route")).GET(
      new Request(`https://queueproof.example/api/ask/${secrets.query}`),
      { params: Promise.resolve({ id: secrets.query }) },
    )],
  ] as const)("sanitises %s at response time", async (_label, getResponse) => {
    const response = await getResponse();
    const body = await response.json();
    expect(response.status, JSON.stringify(body)).toBe(200);
    assertPublicShape(body);
    expect(JSON.stringify(body)).toMatch(/Incident|AuthShield|slack|observable|Public proof workspace|FIXTURE/i);
  });

  it("resolves a public ask handle without returning the stored query primary key", async () => {
    const publicId = await publicQueryReference(secrets.workspace, secrets.query);
    const { GET } = await import("../app/api/ask/[id]/route");
    const response = await GET(
      new Request(`https://queueproof.example/api/ask/${publicId}`),
      { params: Promise.resolve({ id: publicId }) },
    );
    const body = await response.json() as {
      workflow: { queryId: string };
      result: {
        retrieval_receipt: { query_id: string };
        citations: Array<{ id: string; sourceId?: string }>;
      };
    };
    expect(response.status).toBe(200);
    expect(body.workflow.queryId).toBe(publicId);
    expect(body.result.retrieval_receipt.query_id).toBe(publicId);
    expect(body.result.citations[0]?.id).toMatch(/^public-/);
    expect(body.result.citations[0]?.sourceId).toMatch(/^public-/);
    assertPublicShape(body);
  });

  it("round-trips stable queue, graph and connector references without exposing raw ids", async () => {
    const queueResponse = await (await import("../app/api/queue/route")).GET();
    const queueBody = await queueResponse.json() as {
      items: Array<{ taskId: string; packetId: string; packet: { evidence: Array<{ sourceId: string }> } }>;
    };
    const first = queueBody.items[0]!;
    expect(first.taskId).toMatch(/^public-task-/);
    expect(first.packetId).toMatch(/^public-packet-/);
    expect(first.packet.evidence[0]?.sourceId).toMatch(/^public-source-/);

    const packetResponse = await (await import("../app/api/queue/[id]/route")).GET(
      new Request(`https://queueproof.example/api/queue/${first.packetId}`),
      { params: Promise.resolve({ id: first.packetId }) },
    );
    expect(packetResponse.status).toBe(200);
    assertPublicShape(await packetResponse.json());

    const graphResponse = await (await import("../app/api/graph/route")).GET(
      new Request(`https://queueproof.example/api/graph?taskId=${encodeURIComponent(first.taskId)}`),
    );
    const graphBody = await graphResponse.json() as { graph: { nodes: unknown[] } };
    expect(graphResponse.status).toBe(200);
    expect(graphBody.graph.nodes.length).toBeGreaterThan(0);
    assertPublicShape(graphBody);

    const connectorsResponse = await (await import("../app/api/connectors/route")).GET();
    const connectorsBody = await connectorsResponse.json() as { connectors: Array<{ id: string }> };
    const connectorReference = connectorsBody.connectors[0]!.id;
    expect(connectorReference).toMatch(/^public-connector-/);
    const proofResponse = await (await import("../app/api/connectors/[id]/proof/route")).GET(
      new Request(`https://queueproof.example/api/connectors/${connectorReference}/proof`),
      { params: Promise.resolve({ id: connectorReference }) },
    );
    expect(proofResponse.status).toBe(200);
    assertPublicShape(await proofResponse.json());
  });

  it("keeps the safe Hydra readiness parent required by the public Sources screen", async () => {
    const response = await (await import("../app/api/workspace/route")).GET();
    const body = await response.json() as {
      view: { hydradb?: { configured?: boolean }; storageBackend?: string };
    };
    expect(response.status).toBe(200);
    expect(body.view.hydradb).toEqual({ configured: false, verifiedAt: null });
    expect(body.view.storageBackend).toBe("unknown");
  });

  it("allowlists public benchmark rows instead of returning raw artifact diagnostics", async () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "aed027879150e3e324b54c5ec2194d4d715c501e");
    const response = await (await import("../app/api/lab/route")).GET();
    const body = await response.json() as {
      results: {
        live?: { status?: unknown; target?: unknown };
        pdf?: { target?: unknown };
      };
    };
    expect(response.status).toBe(200);
    const serialised = JSON.stringify(body);
    for (const rawField of ["citedSources", "invalidCitationIds", "supportedContradictions", "runner", "health", "command", "sha256"]) {
      expect(serialised).not.toContain(`\"${rawField}\"`);
    }
    expect(serialised).toContain("FIXTURE");
    expect(body.results.live?.status).toBe("awaiting_current_release_measurement");
    expect(body.results.live?.target ?? null).toBeNull();
    expect(body.results.pdf?.target ?? null).toBeNull();
    assertPublicShape(body);
  });

  it("wires the same projector into both queue responses and all anonymous read routes", () => {
    const routes = [
      "app/api/queue/route.ts",
      "app/api/queue/[id]/route.ts",
      "app/api/connectors/route.ts",
      "app/api/connectors/[id]/proof/route.ts",
      "app/api/documents/route.ts",
      "app/api/health/connectors/route.ts",
      "app/api/lab/route.ts",
      "app/api/graph/route.ts",
      "app/api/ask/route.ts",
      "app/api/ask/[id]/route.ts",
    ];
    for (const route of routes) {
      expect(readFileSync(join(process.cwd(), route), "utf8"), route).toContain("publicDtoForActor");
    }
    expect(readFileSync(join(process.cwd(), "lib/server/workspace-state.ts"), "utf8"))
      .toContain("publicDtoForActor");
    const queueRoute = readFileSync(join(process.cwd(), "app/api/queue/route.ts"), "utf8");
    expect(queueRoute.match(/publicDtoForActor\s*\(/g)).toHaveLength(2);
    for (const route of [
      "app/api/graph/route.ts",
      "app/api/health/connectors/route.ts",
      "app/api/connectors/[id]/proof/route.ts",
    ]) {
      expect(readFileSync(join(process.cwd(), route), "utf8"), route).toContain("state != 'deleted'");
    }
    const releaseGate = readFileSync(join(process.cwd(), "scripts/release-gate.mjs"), "utf8");
    expect(releaseGate).toContain("queueproof-public-reference:${expectedPublicWorkspace}:workspace:${expectedPublicWorkspace}");
    expect(releaseGate).toContain("document.sourceReceiptPresent === true");
    expect(releaseGate).not.toContain("document.hydradbSourceId");
  });
});
