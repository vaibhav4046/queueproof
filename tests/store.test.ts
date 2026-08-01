import { beforeAll, describe, expect, it } from "vitest";
import { requireDb } from "../lib/server/runtime";
import { audit, createId, ensureCoreSchema, workspaceForUser } from "../lib/server/store";

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
  });

  it("accepts an event with no workspace, so failures before workspace resolution are recorded", async () => {
    await expect(
      audit({ actorId: "user:anon", operation: "session.denied", outcome: "denied" }),
    ).resolves.toBeUndefined();
  });
});
