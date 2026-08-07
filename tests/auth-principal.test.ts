import { beforeAll, describe, expect, it } from "vitest";
import { ensureExternalPrincipalWorkspace } from "../lib/server/auth-principal";
import { requireDb } from "../lib/server/runtime";
import { ensureCoreSchema } from "../lib/server/store";

describe("external identity tenancy", () => {
  beforeAll(async () => ensureCoreSchema());

  it("keeps the same subject and workspace when an email changes", async () => {
    const first = await ensureExternalPrincipalWorkspace({
      issuer: "https://project.supabase.co/auth/v1",
      subject: "00000000-0000-4000-8000-000000000010",
      email: "first@example.test",
      emailVerified: true,
      displayName: "First Name",
    });
    const second = await ensureExternalPrincipalWorkspace({
      issuer: "https://project.supabase.co/auth/v1",
      subject: "00000000-0000-4000-8000-000000000010",
      email: "changed@example.test",
      emailVerified: true,
      displayName: "Updated Name",
    });
    expect(second.userId).toBe(first.userId);
    expect(second.workspaceId).toBe(first.workspaceId);
    const identity = await requireDb().prepare(
      "SELECT email, display_name AS displayName FROM auth_identities WHERE user_id = ?",
    ).bind(first.userId).first<{ email: string; displayName: string }>();
    expect(identity).toEqual({ email: "changed@example.test", displayName: "Updated Name" });
  });

  it("keeps the web profile when the same subject arrives through MCP without profile claims", async () => {
    const web = await ensureExternalPrincipalWorkspace({
      issuer: "https://project.supabase.co/auth/v1",
      subject: "00000000-0000-4000-8000-000000000020",
      email: "person@example.test",
      emailVerified: true,
      displayName: "Person Name",
      avatarUrl: "https://images.example.test/person.png",
    });
    const mcp = await ensureExternalPrincipalWorkspace({
      issuer: "https://project.supabase.co/auth/v1",
      subject: "00000000-0000-4000-8000-000000000020",
    });

    expect(mcp.userId).toBe(web.userId);
    expect(mcp.workspaceId).toBe(web.workspaceId);
    expect(mcp).toMatchObject({
      email: "person@example.test",
      displayName: "Person Name",
      emailVerified: true,
    });
    const identity = await requireDb().prepare(
      `SELECT email, email_verified AS emailVerified, display_name AS displayName,
              avatar_url AS avatarUrl
       FROM auth_identities WHERE user_id = ?`,
    ).bind(web.userId).first<Record<string, unknown>>();
    expect(identity).toMatchObject({
      email: "person@example.test",
      emailVerified: 1,
      displayName: "Person Name",
      avatarUrl: "https://images.example.test/person.png",
    });
  });

  it("never merges different subjects that share an email address", async () => {
    const shared = "shared@example.test";
    const first = await ensureExternalPrincipalWorkspace({
      issuer: "https://project.supabase.co/auth/v1",
      subject: "00000000-0000-4000-8000-000000000031",
      email: shared,
    });
    const second = await ensureExternalPrincipalWorkspace({
      issuer: "https://project.supabase.co/auth/v1",
      subject: "00000000-0000-4000-8000-000000000032",
      email: shared,
    });
    expect(second.userId).not.toBe(first.userId);
    expect(second.workspaceId).not.toBe(first.workspaceId);
  });

  it("never inherits an existing public workspace when a person signs in", async () => {
    const db = requireDb();
    const publicWorkspaceId = `ws_public_${crypto.randomUUID()}`;
    await db.batch([
      db.prepare("INSERT OR IGNORE INTO users (id, email, display_name) VALUES (?, ?, ?)")
        .bind("user:public-access", "public@queueproof.invalid", "Public workspace"),
      db.prepare("INSERT INTO workspaces (id, slug, name) VALUES (?, ?, ?)")
        .bind(publicWorkspaceId, `public-${crypto.randomUUID()}`, "Public workspace"),
      db.prepare(
        "INSERT INTO workspace_members (id, workspace_id, user_id, role) VALUES (?, ?, ?, 'owner')",
      ).bind(`member_${crypto.randomUUID()}`, publicWorkspaceId, "user:public-access"),
    ]);

    const principal = await ensureExternalPrincipalWorkspace({
      issuer: "https://project.supabase.co/auth/v1",
      subject: "00000000-0000-4000-8000-000000000040",
      email: "private@example.test",
    });
    expect(principal.workspaceId).not.toBe(publicWorkspaceId);
    const memberships = await db.prepare(
      "SELECT workspace_id AS workspaceId FROM workspace_members WHERE user_id = ?",
    ).bind(principal.userId).all<{ workspaceId: string }>();
    expect(memberships.results).toEqual([{ workspaceId: principal.workspaceId }]);
  });
});
