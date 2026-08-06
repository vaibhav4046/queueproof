import { beforeAll, describe, expect, it } from "vitest";
import { ensureExternalPrincipalWorkspace } from "../lib/server/auth-principal";
import { requireDb } from "../lib/server/runtime";
import { ensureCoreSchema } from "../lib/server/store";

describe("external identity tenancy", () => {
  beforeAll(async () => ensureCoreSchema());

  it("keeps the same subject and workspace when an email changes", async () => {
    const first = await ensureExternalPrincipalWorkspace({
      issuer: "https://tenant.example.auth0.com/",
      subject: "auth0|stable-subject",
      email: "first@example.test",
      emailVerified: true,
      displayName: "First Name",
    });
    const second = await ensureExternalPrincipalWorkspace({
      issuer: "https://tenant.example.auth0.com/",
      subject: "auth0|stable-subject",
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

  it("never merges different subjects that share an email address", async () => {
    const shared = "shared@example.test";
    const first = await ensureExternalPrincipalWorkspace({
      issuer: "https://tenant.example.auth0.com/",
      subject: "auth0|subject-a",
      email: shared,
    });
    const second = await ensureExternalPrincipalWorkspace({
      issuer: "https://tenant.example.auth0.com/",
      subject: "auth0|subject-b",
      email: shared,
    });
    expect(second.userId).not.toBe(first.userId);
    expect(second.workspaceId).not.toBe(first.workspaceId);
  });
});
