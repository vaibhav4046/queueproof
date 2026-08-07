import { beforeAll, describe, expect, it } from "vitest";
import { requireDb } from "../lib/server/runtime";
import { createId, ensureCoreSchema } from "../lib/server/store";
import {
  PUBLIC_WORKSPACE_ROLE,
  PUBLIC_WORKSPACE_USER_ID,
  PublicWorkspaceProvisioningError,
  provisionPublicWorkspaceMembership,
  resolveRequestedWorkspaceId,
} from "../scripts/lib/public-workspace-provisioning";

describe("offline public workspace provisioning", () => {
  beforeAll(async () => {
    await ensureCoreSchema();
  });

  async function createWorkspace(name: string) {
    const db = requireDb();
    const ownerId = `user:${crypto.randomUUID()}`;
    const workspaceId = createId("ws");
    await db.batch([
      db
        .prepare("INSERT INTO users (id, email, display_name) VALUES (?, ?, ?)")
        .bind(ownerId, `${crypto.randomUUID()}@example.invalid`, name),
      db
        .prepare("INSERT INTO workspaces (id, slug, name) VALUES (?, ?, ?)")
        .bind(workspaceId, `public-${crypto.randomUUID()}`, name),
      db
        .prepare(
          "INSERT INTO workspace_members (id, workspace_id, user_id, role) VALUES (?, ?, ?, 'owner')",
        )
        .bind(createId("member"), workspaceId, ownerId),
    ]);
    return workspaceId;
  }

  it("upserts an idempotent non-owner membership in one exact existing workspace", async () => {
    const db = requireDb();
    const workspaceId = await createWorkspace("Public provisioning target");

    await expect(provisionPublicWorkspaceMembership(db, workspaceId)).resolves.toEqual({
      workspaceId,
      userId: PUBLIC_WORKSPACE_USER_ID,
      role: PUBLIC_WORKSPACE_ROLE,
    });

    await db
      .prepare(
        "UPDATE workspace_members SET role = 'owner' WHERE workspace_id = ? AND user_id = ?",
      )
      .bind(workspaceId, PUBLIC_WORKSPACE_USER_ID)
      .run();
    await provisionPublicWorkspaceMembership(db, workspaceId);

    const memberships = await db
      .prepare(
        "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?",
      )
      .bind(workspaceId, PUBLIC_WORKSPACE_USER_ID)
      .all<{ role: string }>();
    expect(memberships.results).toEqual([{ role: "member" }]);
  });

  it("fails on a missing workspace without creating an orphan membership", async () => {
    const db = requireDb();
    const missingId = createId("ws_missing");

    await expect(provisionPublicWorkspaceMembership(db, missingId)).rejects.toBeInstanceOf(
      PublicWorkspaceProvisioningError,
    );
    await expect(
      db
        .prepare(
          "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?",
        )
        .bind(missingId, PUBLIC_WORKSPACE_USER_ID)
        .first(),
    ).resolves.toBeNull();
  });

  it("requires one exact, matching CLI or environment selector", () => {
    expect(resolveRequestedWorkspaceId(["--workspace", "ws_exact"], {})).toBe("ws_exact");
    expect(resolveRequestedWorkspaceId([], { QUEUEPROOF_PUBLIC_WORKSPACE_ID: "ws_env" })).toBe(
      "ws_env",
    );
    expect(() => resolveRequestedWorkspaceId(
      ["--workspace", "ws_cli"],
      { QUEUEPROOF_PUBLIC_WORKSPACE_ID: "ws_env" },
    )).toThrow(/different workspaces/i);
    expect(() => resolveRequestedWorkspaceId([], {})).toThrow(/exact existing workspace ID/i);
    const accidentalSecret = "should-not-be-echoed";
    try {
      resolveRequestedWorkspaceId([`--token=${accidentalSecret}`], {});
      throw new Error("unknown CLI input was accepted");
    } catch (error) {
      expect(error).toBeInstanceOf(PublicWorkspaceProvisioningError);
      expect((error as Error).message).not.toContain(accidentalSecret);
    }
  });
});
