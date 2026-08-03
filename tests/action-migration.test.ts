import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

const migration = (name: string) =>
  readFileSync(join(process.cwd(), "drizzle", name), "utf8")
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);

function apply(db: DatabaseSync, name: string) {
  for (const statement of migration(name)) db.exec(statement);
}

function migratedDatabase() {
  const db = new DatabaseSync(":memory:");
  apply(db, "0000_bent_living_mummy.sql");
  apply(db, "0001_action_execution_integrity.sql");
  return db;
}

describe("action execution integrity migration", () => {
  it("migrates the documented schema to the columns used by the runtime", () => {
    const db = new DatabaseSync(":memory:");
    apply(db, "0000_bent_living_mummy.sql");

    db.prepare(
      `INSERT INTO action_approvals
       (id, workspace_id, proposal_id, approver_id, token_hash, expires_at, decision, decided_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run("approval-old", "ws-1", "proposal-1", "user:owner", "legacy-hash", "2999-01-01", "approved", "2026-08-03");
    db.prepare(
      `INSERT INTO action_executions
       (id, workspace_id, proposal_id, provider_response_id, status)
       VALUES (?, ?, ?, ?, ?)`,
    ).run("execution-old", "ws-1", "proposal-1", null, "failed");

    apply(db, "0001_action_execution_integrity.sql");

    const approvalColumns = db.prepare("PRAGMA table_info(action_approvals)").all() as Array<{
      name: string;
      notnull: number;
    }>;
    const executionColumns = db.prepare("PRAGMA table_info(action_executions)").all() as Array<{
      name: string;
      notnull: number;
    }>;
    const approvalByName = new Map(approvalColumns.map((column) => [column.name, column]));
    const executionByName = new Map(executionColumns.map((column) => [column.name, column]));

    for (const required of ["workspace_id", "proposal_id", "decision", "decided_by", "decided_at"]) {
      expect(approvalByName.get(required)?.notnull, required).toBe(1);
    }
    for (const required of ["workspace_id", "proposal_id", "status"]) {
      expect(executionByName.get(required)?.notnull, required).toBe(1);
    }
    expect(executionByName.has("error")).toBe(true);
    expect(
      db.prepare("SELECT decided_by FROM action_approvals WHERE id = ?").get("approval-old"),
    ).toEqual({ decided_by: "user:owner" });
    expect(
      db.prepare("SELECT status, error FROM action_executions WHERE id = ?").get("execution-old"),
    ).toEqual({ status: "failed", error: null });
    db.close();
  });

  it("enforces one approval and one execution per proposal", () => {
    const db = migratedDatabase();

    db.prepare(
      `INSERT INTO action_approvals
       (id, workspace_id, proposal_id, decision, decided_by, decided_at)
       VALUES (?, ?, ?, 'approved', ?, CURRENT_TIMESTAMP)`,
    ).run("approval-1", "ws-1", "proposal-1", "user:owner");
    expect(() =>
      db.prepare(
        `INSERT INTO action_approvals
         (id, workspace_id, proposal_id, decision, decided_by, decided_at)
         VALUES (?, ?, ?, 'approved', ?, CURRENT_TIMESTAMP)`,
      ).run("approval-2", "ws-1", "proposal-1", "user:owner"),
    ).toThrow();

    db.prepare(
      `INSERT INTO action_executions (id, workspace_id, proposal_id, status)
       VALUES (?, ?, ?, 'pending')`,
    ).run("execution-1", "ws-1", "proposal-1");
    expect(() =>
      db.prepare(
        `INSERT INTO action_executions (id, workspace_id, proposal_id, status)
         VALUES (?, ?, ?, 'pending')`,
      ).run("execution-2", "ws-1", "proposal-1"),
    ).toThrow();

    db.close();
  });

  it("scopes action idempotency keys to a workspace", () => {
    const db = migratedDatabase();
    const insert = db.prepare(
      `INSERT INTO action_proposals
       (id, workspace_id, provider, action_type, payload_json, evidence_ids_json,
        risk_class, idempotency_key, status)
       VALUES (?, ?, 'linear', 'create_issue', '{}', '[]', 'low', ?, 'proposed')`,
    );

    insert.run("proposal-1", "ws-1", "same-key");
    expect(() => insert.run("proposal-2", "ws-2", "same-key")).not.toThrow();
    expect(() => insert.run("proposal-3", "ws-1", "same-key")).toThrow();
    db.close();
  });
});
