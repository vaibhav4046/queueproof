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
  const hasDisplayProfile = Boolean(clean(input.displayName, 120) || externalEmail);
  const hasEmailVerification = typeof input.emailVerified === "boolean";
  const workspaceName = displayName === "My QueueProof" ? displayName : `${displayName}'s QueueProof`;
  const slug = `personal-${digest.slice(0, 16)}`;
  const avatarUrl = clean(input.avatarUrl, 2_000) || null;
  const db = requireDb();

  const existingIdentity = await db.prepare(
    `SELECT user_id AS userId FROM auth_identities
     WHERE issuer = ? AND subject = ? LIMIT 1`,
  ).bind(issuer, subject).first<{ userId: string }>();
  if (existingIdentity && existingIdentity.userId !== userId) {
    throw new Response(
      "This external identity conflicts with an existing QueueProof account.",
      { status: 409 },
    );
  }
  const existingMemberships = await db.prepare(
    `SELECT workspace_id AS workspaceId FROM workspace_members
     WHERE user_id = ? ORDER BY workspace_id ASC LIMIT 2`,
  ).bind(userId).all<{ workspaceId: string }>();
  if (
    existingMemberships.results.length > 1 ||
    (existingMemberships.results.length === 1 &&
      existingMemberships.results[0]?.workspaceId !== workspaceId)
  ) {
    throw new Response(
      "This account has an ambiguous workspace membership. Contact the QueueProof owner.",
      { status: 409 },
    );
  }

  await db.batch([
    db.prepare(
      `INSERT OR IGNORE INTO users (id, email, display_name) VALUES (?, ?, ?)`,
    ).bind(userId, internalEmail, displayName),
    db.prepare(
      `UPDATE users SET
         display_name = CASE WHEN ? = 1 THEN ? ELSE display_name END,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    ).bind(hasDisplayProfile ? 1 : 0, displayName, userId),
    db.prepare(
      `INSERT INTO auth_identities
       (id, user_id, issuer, subject, email, email_verified, display_name, avatar_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(issuer, subject) DO UPDATE SET
         email = COALESCE(excluded.email, auth_identities.email),
         email_verified = CASE
           WHEN ? = 1 THEN excluded.email_verified
           ELSE auth_identities.email_verified
         END,
         display_name = CASE
           WHEN ? = 1 THEN excluded.display_name
           ELSE auth_identities.display_name
         END,
         avatar_url = COALESCE(excluded.avatar_url, auth_identities.avatar_url),
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
      hasEmailVerification ? 1 : 0,
      hasDisplayProfile ? 1 : 0,
    ),
    db.prepare(
      `INSERT OR IGNORE INTO workspaces (id, slug, name) VALUES (?, ?, ?)`,
    ).bind(workspaceId, slug, workspaceName),
    db.prepare(
      `INSERT OR IGNORE INTO workspace_members (id, workspace_id, user_id, role)
       VALUES (?, ?, ?, 'owner')`,
    ).bind(membershipId, workspaceId, userId),
  ]);

  const persistedIdentity = await db.prepare(
    `SELECT ai.user_id AS userId, ai.email, ai.email_verified AS emailVerified,
            COALESCE(ai.display_name, u.display_name) AS displayName
     FROM auth_identities ai
     JOIN users u ON u.id = ai.user_id
     WHERE ai.issuer = ? AND ai.subject = ? LIMIT 1`,
  ).bind(issuer, subject).first<{
    userId: string;
    email: string | null;
    emailVerified: number | boolean;
    displayName: string | null;
  }>();
  if (!persistedIdentity || persistedIdentity.userId !== userId) {
    throw new Response(
      "This external identity conflicts with an existing QueueProof account.",
      { status: 409 },
    );
  }

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
    email: persistedIdentity.email ?? internalEmail,
    displayName: persistedIdentity.displayName ?? displayName,
    emailVerified: Boolean(persistedIdentity.emailVerified),
  };
}
