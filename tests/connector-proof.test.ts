import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { GET } from "../app/api/connectors/[id]/proof/route";
import {
  CONNECTOR_PROOF_MAX_AGE_HOURS,
  connectorProofFreshness,
} from "../lib/server/connector-proof";
import { requireDb } from "../lib/server/runtime";
import { createId, ensureCoreSchema } from "../lib/server/store";

const workspaceId = createId("ws_proof_visibility");
const connectorId = createId("connector_proof_visibility");
const localActorId = "user:local-development";
const resourceIds = {
  visible: "repo:selected-and-verified",
  unselected: "repo:private-unselected",
  configured: "repo:selected-not-verified",
  historical: "repo:verified-not-selected",
  receiptOnly: "repo:receipt-only-private",
};

async function readProof() {
  const response = await GET(
    new Request(`http://queueproof.test/api/connectors/${connectorId}/proof`),
    { params: Promise.resolve({ id: connectorId }) },
  );
  return { response, body: await response.json() };
}

describe("connector proof disclosure boundary", () => {
  beforeAll(async () => {
    await ensureCoreSchema();
    const db = requireDb();
    const verifiedAt = new Date().toISOString();

    await db.batch([
      db.prepare("INSERT INTO users (id, email, display_name) VALUES (?, ?, ?)")
        .bind(localActorId, "local-proof@example.invalid", "Local proof owner"),
      db.prepare("INSERT INTO users (id, email, display_name) VALUES (?, ?, ?)")
        .bind("user:public-access", "public-proof@example.invalid", "Public proof visitor"),
      db.prepare("INSERT INTO workspaces (id, slug, name) VALUES (?, ?, ?)")
        .bind(workspaceId, `proof-${workspaceId.slice(-8)}`, "Proof visibility"),
      db.prepare(
        "INSERT INTO workspace_members (id, workspace_id, user_id, role) VALUES (?, ?, ?, 'owner')",
      ).bind(createId("member"), workspaceId, localActorId),
      db.prepare(
        "INSERT INTO workspace_members (id, workspace_id, user_id, role) VALUES (?, ?, ?, 'member')",
      ).bind(createId("member"), workspaceId, "user:public-access"),
      db.prepare(
        `INSERT INTO connectors
         (id, workspace_id, hydradb_connector_id, provider, name, database, state)
         VALUES (?, ?, ?, 'github', 'Owner GitHub', 'queueproof', 'verified')`,
      ).bind(connectorId, workspaceId, "hydra-proof-connector"),
      ...[
        [resourceIds.visible, 1, "verified"],
        [resourceIds.unselected, 0, "discovered"],
        [resourceIds.configured, 1, "configured"],
        [resourceIds.historical, 0, "verified"],
      ].map(([externalId, selected, status]) => db.prepare(
        `INSERT INTO connector_resources
         (id, workspace_id, connector_id, external_resource_id, resource_type, display_name, selected, status)
         VALUES (?, ?, ?, ?, 'repository', ?, ?, ?)`,
      ).bind(
        createId("resource"),
        workspaceId,
        connectorId,
        externalId,
        externalId,
        selected,
        status,
      )),
      db.prepare(
        `INSERT INTO connection_verifications
         (id, workspace_id, connector_id, provider, resource_ids_json, verification_stage,
          canary_result_count, source_ids_json, provider_coverage_json, verified_at)
         VALUES (?, ?, ?, 'github', ?, 'verified', 3, '["hydra-source"]', '["github"]', ?)`,
      ).bind(
        createId("verification"),
        workspaceId,
        connectorId,
        JSON.stringify([...Object.values(resourceIds)]),
        verifiedAt,
      ),
    ]);
  });

  afterEach(() => vi.unstubAllEnvs());

  it("returns only selected, verified resources and matching receipt IDs to public access", async () => {
    vi.stubEnv("QUEUEPROOF_ENCRYPTION_KEY", "");
    vi.stubEnv("QUEUEPROOF_TRUSTED_IDENTITY_PROXY", "");
    vi.stubEnv("QUEUEPROOF_ALLOW_LOCAL_IDENTITY", "false");
    vi.stubEnv("QUEUEPROOF_PUBLIC_ACCESS", "true");
    vi.stubEnv("QUEUEPROOF_PUBLIC_WORKSPACE_ID", workspaceId);

    const { response, body } = await readProof();

    expect(response.status).toBe(200);
    const publicResourceIds = body.resources.map((resource: { id: string }) => resource.id);
    expect(publicResourceIds).toHaveLength(1);
    expect(publicResourceIds[0]).toMatch(/^public-resource-/);
    expect(body.verification.resourceIds).toEqual(publicResourceIds);
    expect(JSON.stringify(body)).not.toContain(resourceIds.visible);
    expect(JSON.stringify(body)).not.toContain("hydra-source");
    expect(body.proofFreshness).toMatchObject({
      status: "current",
      maxAgeHours: CONNECTOR_PROOF_MAX_AGE_HOURS,
    });
  });

  it("keeps the complete resource inventory and receipt available to the owner", async () => {
    vi.stubEnv("QUEUEPROOF_ENCRYPTION_KEY", "");
    vi.stubEnv("QUEUEPROOF_TRUSTED_IDENTITY_PROXY", "");
    vi.stubEnv("QUEUEPROOF_ALLOW_LOCAL_IDENTITY", "true");
    vi.stubEnv("QUEUEPROOF_PUBLIC_ACCESS", "true");
    vi.stubEnv("QUEUEPROOF_PUBLIC_WORKSPACE_ID", workspaceId);

    const { response, body } = await readProof();

    expect(response.status).toBe(200);
    expect(body.resources.map((resource: { id: string }) => resource.id).sort()).toEqual(
      [
        resourceIds.visible,
        resourceIds.unselected,
        resourceIds.configured,
        resourceIds.historical,
      ].sort(),
    );
    expect(body.verification.resourceIds).toEqual(Object.values(resourceIds));
  });
});

describe("connector proof freshness", () => {
  const now = Date.parse("2026-08-05T12:00:00.000Z");

  it("reports recent proof as current without making it a readiness gate", () => {
    expect(connectorProofFreshness("2026-08-02T12:00:00.000Z", now)).toEqual({
      status: "current",
      ageHours: 72,
      maxAgeHours: 168,
      expiresAt: "2026-08-09T12:00:00.000Z",
    });
  });

  it("reports expired or malformed proof honestly", () => {
    expect(connectorProofFreshness("2026-07-20T12:00:00.000Z", now).status).toBe("stale");
    expect(connectorProofFreshness("not-a-date", now)).toMatchObject({
      status: "unverified",
      ageHours: null,
      expiresAt: null,
    });
  });
});
