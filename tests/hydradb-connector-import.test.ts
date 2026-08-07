import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { encryptSecret, secretFingerprint } from "../lib/server/crypto";
import { requireDb } from "../lib/server/runtime";
import { createId, ensureCoreSchema } from "../lib/server/store";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Headers(),
}));

const actorId = "user:local-development";
const workspaceId = createId("ws_hydra_import");
const apiKey = "hydra-test-key-for-import-route";
const encryptionKey = "hydra-import-test-encryption-key-material";
const encryptionEnvName = ["QUEUEPROOF", "ENCRYPTION", "KEY"].join("_");
const originalEncryptionKey = process.env[encryptionEnvName];
const originalLocalIdentity = process.env.QUEUEPROOF_ALLOW_LOCAL_IDENTITY;

function mockHydraConnectors(connectors: Array<Record<string, unknown>>) {
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    expect(url.origin).toBe("https://api.hydradb.com");
    expect(url.pathname).toBe("/connectors");
    expect(new Headers(init?.headers).get("Authorization")).toBe(`Bearer ${apiKey}`);
    return Response.json(
      { connectors },
      { status: 200, headers: { "x-request-id": "hydra-import-test-request" } },
    );
  }));
}

describe("existing HydraDB connector import route", () => {
  beforeAll(async () => {
    process.env[encryptionEnvName] = encryptionKey;
    process.env.QUEUEPROOF_ALLOW_LOCAL_IDENTITY = "true";
    await ensureCoreSchema();
    const db = requireDb();
    await db.batch([
      db.prepare("INSERT INTO users (id, email, display_name) VALUES (?, ?, ?)")
        .bind(actorId, "hydra-import@example.invalid", "Hydra import test"),
      db.prepare("INSERT INTO workspaces (id, slug, name) VALUES (?, ?, ?)")
        .bind(workspaceId, `hydra-import-${workspaceId.slice(-8)}`, "Hydra import test"),
      db.prepare(
        "INSERT INTO workspace_members (id, workspace_id, user_id, role) VALUES (?, ?, ?, 'owner')",
      ).bind(createId("member"), workspaceId, actorId),
      db.prepare(
        `INSERT INTO hydradb_accounts
         (id, workspace_id, base_url, encrypted_api_key, key_fingerprint, verified_at, status)
         VALUES (?, ?, 'https://api.hydradb.com', ?, ?, CURRENT_TIMESTAMP, 'verified')`,
      ).bind(
        createId("hydra"),
        workspaceId,
        await encryptSecret(apiKey),
        await secretFingerprint(apiKey),
      ),
    ]);
  });

  afterEach(() => vi.unstubAllGlobals());
  afterAll(() => {
    if (originalEncryptionKey === undefined) delete process.env[encryptionEnvName];
    else process.env[encryptionEnvName] = originalEncryptionKey;
    if (originalLocalIdentity === undefined) delete process.env.QUEUEPROOF_ALLOW_LOCAL_IDENTITY;
    else process.env.QUEUEPROOF_ALLOW_LOCAL_IDENTITY = originalLocalIdentity;
  });

  it("lists only sanitised connector references accessible to the attached account", async () => {
    mockHydraConnectors([{
      connector_id: "hydra-existing-list",
      provider: "slack",
      name: "Existing Slack",
      database: "work",
      credential_ref: "must-not-be-returned",
    }]);
    const { GET } = await import("../app/api/hydradb/connectors/route");
    const response = await GET();
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      proofBoundary: {
        accountAccess: "verified_by_attached_hydradb_key",
        retrieval: "requires_queueproof_scope_and_canary_verification",
      },
    });
    expect(JSON.stringify(body)).not.toContain("must-not-be-returned");
  });

  it("re-fetches account access and imports upstream identity fields without enabling retrieval", async () => {
    mockHydraConnectors([{
      connector_id: "hydra-existing-import",
      provider: "linear",
      name: "Existing Linear",
      database: "authoritative-work",
      collection: "delivery",
      provider_account_scope: "org:real",
      status: "active",
      sync_status: "complete",
    }]);
    const { POST } = await import("../app/api/hydradb/connectors/route");
    const response = await POST(new Request("https://queueproof.example/api/hydradb/connectors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        connectorIds: ["hydra-existing-import"],
        provider: "attacker-provider",
        database: "attacker-database",
      }),
    }));
    const body = await response.json() as Record<string, unknown>;

    expect(response.status, JSON.stringify(body)).toBe(201);
    expect(body).toMatchObject({ ok: true, newlyImportedCount: 1 });
    const stored = await requireDb().prepare(
      `SELECT provider, database, collection, account_scope AS accountScope, state
       FROM connectors WHERE workspace_id = ? AND hydradb_connector_id = ?`,
    ).bind(workspaceId, "hydra-existing-import").first<Record<string, unknown>>();
    expect(stored).toMatchObject({
      provider: "linear",
      database: "authoritative-work",
      collection: "delivery",
      accountScope: "org:real",
      state: "connector_created",
    });
    expect(JSON.stringify(body)).toContain('"retrievalEligible":false');
  });

  it("rejects an identifier missing from the fresh account-scoped HydraDB list", async () => {
    mockHydraConnectors([]);
    const { POST } = await import("../app/api/hydradb/connectors/route");
    const response = await POST(new Request("https://queueproof.example/api/hydradb/connectors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectorIds: ["hydra-from-another-account"] }),
    }));

    expect(response.status).toBe(400);
    const count = await requireDb().prepare(
      "SELECT COUNT(*) AS total FROM connectors WHERE workspace_id = ? AND hydradb_connector_id = ?",
    ).bind(workspaceId, "hydra-from-another-account").first<{ total: number }>();
    expect(Number(count?.total ?? 0)).toBe(0);
  });
});
