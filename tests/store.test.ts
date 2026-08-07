import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { requireDb } from "../lib/server/runtime";
import {
  audit,
  createId,
  enforcePublicRateLimit,
  ensureCoreSchema,
  requireOwnerWorkspaceForUser,
  workspaceForUser,
} from "../lib/server/store";

/**
 * First tests to exercise the real persistence layer.
 *
 * Until the cloudflare:workers test shim supplied a database, requireDb() threw inside
 * every test, so store.ts, all API routes and all MCP handlers were uncovered — which is
 * how a missing action_proposals table and a permanently-throwing MCP tool both shipped.
 */
describe("core schema", () => {
  beforeAll(async () => {
    await ensureCoreSchema();
  });

  it("creates the tables the product actually queries", async () => {
    const rows = await requireDb()
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all<{ name: string }>();
    const tables = new Set(rows.results.map((row) => row.name));

    for (const required of [
      "users",
      "auth_identities",
      "workspaces",
      "workspace_members",
      "hydradb_accounts",
      "connectors",
      "connector_resources",
      "execution_packets",
      "queue_snapshots",
      "mcp_tokens",
      "audit_events",
    ]) {
      expect(tables.has(required), `missing table: ${required}`).toBe(true);
    }
  });

  it("creates the action tables the MCP proposal tools depend on", async () => {
    // These were absent, so queueproof_propose_action and queueproof_get_action_status
    // threw "no such table" on every call.
    const rows = await requireDb()
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('action_proposals','action_approvals','action_executions')",
      )
      .all<{ name: string }>();
    expect(rows.results.map((row) => row.name).sort()).toEqual([
      "action_approvals",
      "action_executions",
      "action_proposals",
    ]);
  });

  it("is safe to run more than once", async () => {
    await expect(ensureCoreSchema()).resolves.toBeUndefined();
  });
});

describe("workspace ownership", () => {
  beforeAll(async () => {
    await ensureCoreSchema();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  async function createWorkspace(userId: string, name: string) {
    const db = requireDb();
    const workspaceId = createId("ws");
    await db.batch([
      db
        .prepare("INSERT OR IGNORE INTO users (id, email, display_name) VALUES (?, ?, ?)")
        .bind(userId, `${userId}@example.invalid`, userId),
      db
        .prepare("INSERT INTO workspaces (id, slug, name) VALUES (?, ?, ?)")
        .bind(workspaceId, `${name.toLowerCase()}-${workspaceId.slice(-6)}`, name),
      db
        .prepare(
          "INSERT INTO workspace_members (id, workspace_id, user_id, role) VALUES (?, ?, ?, 'owner')",
        )
        .bind(createId("member"), workspaceId, userId),
    ]);
    return workspaceId;
  }

  it("returns null before any workspace exists for a user", async () => {
    expect(await workspaceForUser("user:nobody")).toBeNull();
  });

  it("returns the workspace a user owns", async () => {
    const workspaceId = await createWorkspace("user:alice", "Helios");
    const workspace = await workspaceForUser("user:alice");
    expect(workspace?.id).toBe(workspaceId);
    expect(workspace?.name).toBe("Helios");
  });

  it("does not leak one user's workspace to another user", async () => {
    // Tenant isolation is the property the whole product depends on: every route scopes
    // its SQL by a server-resolved workspace_id derived from this lookup.
    await createWorkspace("user:bob", "Rover");
    const alice = await workspaceForUser("user:alice");
    const bob = await workspaceForUser("user:bob");

    expect(alice?.id).not.toBe(bob?.id);
    expect(alice?.name).toBe("Helios");
    expect(bob?.name).toBe("Rover");
    expect(await workspaceForUser("user:carol")).toBeNull();
  });

  it("fails closed when an account has more than one workspace and no explicit selection", async () => {
    const userId = "user:ambiguous-workspaces";
    await createWorkspace(userId, "FirstSpace");
    await createWorkspace(userId, "SecondSpace");
    await expect(workspaceForUser(userId)).rejects.toMatchObject({ status: 409 });
  });

  it("requires the durable owner role for control-plane workspace access", async () => {
    const db = requireDb();
    const ownerId = "user:owner-guard";
    const memberId = "user:member-guard";
    const workspaceId = await createWorkspace(ownerId, "OwnerGuard");
    await db.batch([
      db
        .prepare("INSERT OR IGNORE INTO users (id, email, display_name) VALUES (?, ?, ?)")
        .bind(memberId, "member-guard@example.invalid", "Member guard"),
      db
        .prepare("INSERT INTO workspace_members (id, workspace_id, user_id, role) VALUES (?, ?, ?, 'member')")
        .bind(createId("member"), workspaceId, memberId),
    ]);

    await expect(requireOwnerWorkspaceForUser(ownerId)).resolves.toMatchObject({ id: workspaceId });
    try {
      await requireOwnerWorkspaceForUser(memberId);
      throw new Error("non-owner control-plane access was not rejected");
    } catch (error) {
      expect(error).toBeInstanceOf(Response);
      expect((error as Response).status).toBe(403);
    }
  });

  it("fails closed instead of assigning an ambiguous oldest workspace to public access", async () => {
    expect(await workspaceForUser("user:public-access")).toBeNull();
  });

  it("requires the configured public workspace to have an explicit public membership", async () => {
    const privateWorkspaceId = await createWorkspace("user:private-only", "PrivateOnly");
    vi.stubEnv("QUEUEPROOF_PUBLIC_WORKSPACE_ID", privateWorkspaceId);
    expect(await workspaceForUser("user:public-access")).toBeNull();

    const db = requireDb();
    await db.batch([
      db
        .prepare("INSERT OR IGNORE INTO users (id, email, display_name) VALUES (?, ?, ?)")
        .bind("user:public-access", "public-workspace@example.invalid", "Public workspace"),
      db
        .prepare("INSERT INTO workspace_members (id, workspace_id, user_id, role) VALUES (?, ?, ?, 'member')")
        .bind(createId("member"), privateWorkspaceId, "user:public-access"),
    ]);

    await expect(workspaceForUser("user:public-access")).resolves.toMatchObject({
      id: privateWorkspaceId,
    });
  });

  it("does not grant public membership from deployment settings alone", async () => {
    const workspaceId = await createWorkspace("user:public-migration-owner", "PublicMigration");
    vi.stubEnv("QUEUEPROOF_PUBLIC_ACCESS", "true");
    vi.stubEnv("QUEUEPROOF_PUBLIC_WORKSPACE_ID", workspaceId);

    await expect(workspaceForUser("user:public-access")).resolves.toBeNull();
    await expect(requireDb().prepare(
      "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?",
    ).bind(workspaceId, "user:public-access").first<{ role: string }>()).resolves.toBeNull();
  });

  it("rolls back the whole workspace batch if membership insertion fails", async () => {
    const db = requireDb();
    const workspaceId = createId("ws");
    await expect(
      db.batch([
        db
          .prepare("INSERT INTO workspaces (id, slug, name) VALUES (?, ?, ?)")
          .bind(workspaceId, `orphan-${workspaceId.slice(-6)}`, "Orphan"),
        // Duplicate primary key: this statement must fail.
        db
          .prepare("INSERT INTO workspace_members (id, workspace_id, user_id, role) VALUES (?, ?, ?, 'owner')")
          .bind("dup-member", workspaceId, "user:alice"),
        db
          .prepare("INSERT INTO workspace_members (id, workspace_id, user_id, role) VALUES (?, ?, ?, 'owner')")
          .bind("dup-member", workspaceId, "user:alice"),
      ]),
    ).rejects.toThrow();

    // A surviving workspace with no owning member would be unreachable and unownable.
    const orphan = await db
      .prepare("SELECT id FROM workspaces WHERE id = ?")
      .bind(workspaceId)
      .first();
    expect(orphan).toBeNull();
  });
});

describe("audit trail", () => {
  beforeAll(async () => {
    await ensureCoreSchema();
  });

  it("records an audit event with its workspace, actor and outcome", async () => {
    const workspaceId = createId("ws");
    await audit({
      workspaceId,
      actorId: "user:alice",
      operation: "workspace.create",
      targetType: "workspace",
      targetId: workspaceId,
      outcome: "success",
      riskClass: "write",
    });

    const row = await requireDb()
      .prepare("SELECT * FROM audit_events WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 1")
      .bind(workspaceId)
      .first<{ operation: string; outcome: string; risk_class: string; actor_id: string }>();

    expect(row?.operation).toBe("workspace.create");
    expect(row?.outcome).toBe("success");
    expect(row?.risk_class).toBe("write");
    expect(row?.actor_id).toBe("user:alice");

    const rateWorkspace = createId("ws_rate");
    await enforcePublicRateLimit({
      actorId: "user:public-access", workspaceId: rateWorkspace,
      operation: "test", limit: 1, windowMs: 60_000,
    });
    try {
      await enforcePublicRateLimit({
        actorId: "user:public-access", workspaceId: rateWorkspace,
        operation: "test", limit: 1, windowMs: 60_000,
      });
      throw new Error("rate limit did not reject");
    } catch (error) {
      expect(error).toBeInstanceOf(Response);
      expect((error as Response).status).toBe(429);
    }
  });

  it("accepts an event with no workspace, so failures before workspace resolution are recorded", async () => {
    await expect(
      audit({ actorId: "user:anon", operation: "session.denied", outcome: "denied" }),
    ).resolves.toBeUndefined();
  });

  it("retains a deployment-wide ceiling across anonymous client buckets", async () => {
    const workspaceId = createId("ws_global_rate");
    await audit({
      workspaceId,
      actorId: "public-client:already-counted",
      operation: "rate_limit.global-test",
      targetType: "public_rate_limit",
      outcome: "success",
    });

    await expect(enforcePublicRateLimit({
      actorId: "user:public-access",
      workspaceId,
      operation: "global-test",
      limit: 100,
      globalLimit: 1,
      windowMs: 60_000,
    })).rejects.toMatchObject({ status: 429 });
  });
});
