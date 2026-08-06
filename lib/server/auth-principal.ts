import { requireDb } from "./runtime";
import { ensureCoreSchema } from "./store";
import { sha256 } from "../../packages/security/src";

export type ExternalPrincipal = {
  issuer: string;
  subject: string;
  email?: string | null;
  emailVerified?: boolean;
  displayName?: string | null;
  avatarUrl?: string | null;
};

export type ProvisionedPrincipal = {
  userId: string;
  workspaceId: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
};

function clean(value: string | null | undefined, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function safeName(input: ExternalPrincipal, fallback: string): string {
  return clean(input.displayName, 120) || clean(input.email, 254) || fallback;
}

/**
 * Provision one deterministic personal workspace per external OAuth subject.
 *
 * The users table keeps its historic non-null/unique email contract, so the internal
 * row uses a non-PII synthetic address. The real, mutable email belongs to the external
 * identity row and is never used as a tenant key.
 */
export async function ensureExternalPrincipalWorkspace(
  input: ExternalPrincipal,
): Promise<ProvisionedPrincipal> {
  const issuer = clean(input.issuer, 500);
  const subject = clean(input.subject, 500);
  if (!/^https:\/\//i.test(issuer) || !subject) {
    throw new Response("The external identity is incomplete.", { status: 401 });
  }

  await ensureCoreSchema();
  const digest = await sha256(`${issuer}\0${subject}`);
  const userId = `user:auth0:${digest}`;
  const workspaceId = `ws_auth0_${digest.slice(0, 32)}`;
  const identityId = `identity_auth0_${digest.slice(0, 32)}`;
  const membershipId = `member_auth0_${digest.slice(0, 32)}`;
  const internalEmail = `${digest}@auth.queueproof.invalid`;
  const externalEmail = clean(input.email, 254) || null;
  const displayName = safeName(input, "My QueueProof");
  const workspaceName = displayName === "My QueueProof" ? displayName : `${displayName}'s QueueProof`;
  const slug = `personal-${digest.slice(0, 16)}`;
  const avatarUrl = clean(input.avatarUrl, 2_000) || null;
  const db = requireDb();

  await db.batch([
    db.prepare(
      `INSERT OR IGNORE INTO users (id, email, display_name) VALUES (?, ?, ?)`,
    ).bind(userId, internalEmail, displayName),
    db.prepare(
      `UPDATE users SET display_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    ).bind(displayName, userId),
    db.prepare(
      `INSERT INTO auth_identities
       (id, user_id, issuer, subject, email, email_verified, display_name, avatar_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(issuer, subject) DO UPDATE SET
         email = excluded.email,
         email_verified = excluded.email_verified,
         display_name = excluded.display_name,
         avatar_url = excluded.avatar_url,
         updated_at = CURRENT_TIMESTAMP`,
    ).bind(
      identityId,
      userId,
      issuer,
      subject,
      externalEmail,
      input.emailVerified ? 1 : 0,
      displayName,
      avatarUrl,
    ),
    db.prepare(
      `INSERT OR IGNORE INTO workspaces (id, slug, name) VALUES (?, ?, ?)`,
    ).bind(workspaceId, slug, workspaceName),
    db.prepare(
      `INSERT OR IGNORE INTO workspace_members (id, workspace_id, user_id, role)
       VALUES (?, ?, ?, 'owner')`,
    ).bind(membershipId, workspaceId, userId),
  ]);

  const memberships = await db.prepare(
    `SELECT workspace_id AS workspaceId FROM workspace_members
     WHERE user_id = ? ORDER BY workspace_id ASC LIMIT 2`,
  ).bind(userId).all<{ workspaceId: string }>();
  if (memberships.results.length !== 1 || memberships.results[0]?.workspaceId !== workspaceId) {
    throw new Response(
      "This account has an ambiguous workspace membership. Contact the QueueProof owner.",
      { status: 409 },
    );
  }

  return {
    userId,
    workspaceId,
    email: externalEmail ?? internalEmail,
    displayName,
    emailVerified: Boolean(input.emailVerified),
  };
}
