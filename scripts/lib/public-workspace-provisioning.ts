export const PUBLIC_WORKSPACE_USER_ID = "user:public-access";
export const PUBLIC_WORKSPACE_ROLE = "member";

const PUBLIC_WORKSPACE_EMAIL = "public-access@queueproof.invalid";
const PUBLIC_WORKSPACE_DISPLAY_NAME = "QueueProof public reviewer";
const PROVISIONER_ACTOR_ID = "system:public-workspace-provisioner";

type ProvisioningDatabase = Pick<D1Database, "prepare" | "batch">;

export type PublicWorkspaceProvisioningResult = {
  workspaceId: string;
  userId: typeof PUBLIC_WORKSPACE_USER_ID;
  role: typeof PUBLIC_WORKSPACE_ROLE;
};

export type ReviewedPublicWorkspaceProvisioningResult = PublicWorkspaceProvisioningResult & {
  changed: boolean;
  verifiedConnectorCount: number;
  indexedDocumentCount: number;
};

export class PublicWorkspaceProvisioningError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicWorkspaceProvisioningError";
  }
}

export function resolveRequestedWorkspaceId(
  argv: string[],
  env: Record<string, string | undefined>,
): string {
  let cliWorkspace = "";
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") continue;
    if (argument === "--workspace") {
      if (cliWorkspace || index + 1 >= argv.length) {
        throw new PublicWorkspaceProvisioningError(
          "Pass --workspace exactly once with one workspace ID.",
        );
      }
      cliWorkspace = argv[index + 1];
      index += 1;
      continue;
    }
    if (argument.startsWith("--workspace=")) {
      if (cliWorkspace) {
        throw new PublicWorkspaceProvisioningError("Pass --workspace exactly once.");
      }
      cliWorkspace = argument.slice("--workspace=".length);
      continue;
    }
    throw new PublicWorkspaceProvisioningError(
      "Unknown argument. Use only --workspace <exact-workspace-id>.",
    );
  }

  const envWorkspace = env.QUEUEPROOF_PUBLIC_WORKSPACE_ID ?? "";
  if (cliWorkspace && envWorkspace && cliWorkspace !== envWorkspace) {
    throw new PublicWorkspaceProvisioningError(
      "--workspace and QUEUEPROOF_PUBLIC_WORKSPACE_ID identify different workspaces.",
    );
  }
  const selected = cliWorkspace || envWorkspace;
  if (!selected) {
    throw new PublicWorkspaceProvisioningError(
      "Provide the exact existing workspace ID with --workspace or QUEUEPROOF_PUBLIC_WORKSPACE_ID.",
    );
  }
  return selected;
}

/**
 * Persist the deliberately shared reviewer identity in one exact, existing workspace.
 *
 * This helper belongs to the offline provisioning command. Request handlers and workspace
 * resolution must never call it: reading deployment settings is not authority to mutate tenant
 * membership. The guarded INSERT ... SELECT statements make a concurrent workspace removal a
 * no-op, while `batch` makes user, membership, and audit writes atomic.
 */
export async function provisionPublicWorkspaceMembership(
  db: ProvisioningDatabase,
  workspaceId: string,
): Promise<PublicWorkspaceProvisioningResult> {
  if (!workspaceId || workspaceId !== workspaceId.trim()) {
    throw new PublicWorkspaceProvisioningError(
      "Pass one exact workspace ID without leading or trailing whitespace.",
    );
  }
  if (workspaceId.length > 255 || /[\u0000-\u001f\u007f]/.test(workspaceId)) {
    throw new PublicWorkspaceProvisioningError("The workspace ID is not valid.");
  }

  const workspace = await db
    .prepare("SELECT id FROM workspaces WHERE id = ? LIMIT 1")
    .bind(workspaceId)
    .first<{ id: string }>();
  if (!workspace || workspace.id !== workspaceId) {
    throw new PublicWorkspaceProvisioningError(
      "The exact workspace ID does not exist; no membership was changed.",
    );
  }

  const membershipId = `member_${crypto.randomUUID()}`;
  const auditId = `audit_${crypto.randomUUID()}`;
  const operationId = crypto.randomUUID();

  await db.batch([
    db
      .prepare(
        `INSERT INTO users (id, email, display_name)
         SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM workspaces WHERE id = ?)
         ON CONFLICT(id) DO UPDATE SET
           display_name = excluded.display_name,
           updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(
        PUBLIC_WORKSPACE_USER_ID,
        PUBLIC_WORKSPACE_EMAIL,
        PUBLIC_WORKSPACE_DISPLAY_NAME,
        workspaceId,
      ),
    db
      .prepare(
        `INSERT INTO workspace_members (id, workspace_id, user_id, role)
         SELECT ?, id, ?, ? FROM workspaces WHERE id = ?
         ON CONFLICT(workspace_id, user_id) DO UPDATE SET
           role = excluded.role,
           updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(
        membershipId,
        PUBLIC_WORKSPACE_USER_ID,
        PUBLIC_WORKSPACE_ROLE,
        workspaceId,
      ),
    db
      .prepare(
        `INSERT INTO audit_events
         (id, workspace_id, actor_id, operation, operation_id, target_type, target_id,
          outcome, risk_class, metadata_json)
         SELECT ?, id, ?, 'public_workspace.provision', ?, 'workspace_member', ?,
                'success', 'write', ?
         FROM workspaces WHERE id = ?`,
      )
      .bind(
        auditId,
        PROVISIONER_ACTOR_ID,
        operationId,
        PUBLIC_WORKSPACE_USER_ID,
        JSON.stringify({ role: PUBLIC_WORKSPACE_ROLE }),
        workspaceId,
      ),
  ]);

  const persisted = await db
    .prepare(
      `SELECT wm.workspace_id, wm.user_id, wm.role
       FROM workspace_members wm
       JOIN workspaces w ON w.id = wm.workspace_id
       JOIN users u ON u.id = wm.user_id
       WHERE wm.workspace_id = ? AND wm.user_id = ? LIMIT 1`,
    )
    .bind(workspaceId, PUBLIC_WORKSPACE_USER_ID)
    .first<{ workspace_id: string; user_id: string; role: string }>();

  if (
    !persisted ||
    persisted.workspace_id !== workspaceId ||
    persisted.user_id !== PUBLIC_WORKSPACE_USER_ID ||
    persisted.role !== PUBLIC_WORKSPACE_ROLE
  ) {
    throw new PublicWorkspaceProvisioningError(
      "The workspace disappeared or the non-owner membership could not be verified.",
    );
  }

  return {
    workspaceId,
    userId: PUBLIC_WORKSPACE_USER_ID,
    role: PUBLIC_WORKSPACE_ROLE,
  };
}

/**
 * Deployment-only migration for the existing hackathon judge workspace.
 *
 * A deployment setting alone is never sufficient authority to publish a tenant. Before adding
 * the deliberately public member, this requires the selected workspace to look exactly like the
 * already-reviewed demo: no Supabase identities, at least three independently verified
 * connectors, and an indexed document carrying a HydraDB source receipt. Personal workspaces
 * therefore fail closed even if their ID is accidentally selected.
 */
export async function provisionReviewedPublicWorkspaceMembership(
  db: ProvisioningDatabase,
  workspaceId: string,
): Promise<ReviewedPublicWorkspaceProvisioningResult> {
  const existing = await db
    .prepare(
      `SELECT role FROM workspace_members
       WHERE workspace_id = ? AND user_id = ? LIMIT 1`,
    )
    .bind(workspaceId, PUBLIC_WORKSPACE_USER_ID)
    .first<{ role: string }>();

  const [connectors, documents, externalIdentities] = await Promise.all([
    db
      .prepare(
        `SELECT COUNT(*) AS count FROM connectors
         WHERE workspace_id = ? AND state = 'data_verified'`,
      )
      .bind(workspaceId)
      .first<{ count: number | string }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS count FROM documents
         WHERE workspace_id = ? AND stage = 'indexed'
           AND hydradb_source_id IS NOT NULL AND TRIM(hydradb_source_id) != ''`,
      )
      .bind(workspaceId)
      .first<{ count: number | string }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM workspace_members wm
         JOIN auth_identities ai ON ai.user_id = wm.user_id
         WHERE wm.workspace_id = ?`,
      )
      .bind(workspaceId)
      .first<{ count: number | string }>(),
  ]);

  const verifiedConnectorCount = Number(connectors?.count ?? 0);
  const indexedDocumentCount = Number(documents?.count ?? 0);
  const externalIdentityCount = Number(externalIdentities?.count ?? 0);
  if (
    !Number.isSafeInteger(verifiedConnectorCount) || verifiedConnectorCount < 3 ||
    !Number.isSafeInteger(indexedDocumentCount) || indexedDocumentCount < 1 ||
    !Number.isSafeInteger(externalIdentityCount) || externalIdentityCount !== 0
  ) {
    throw new PublicWorkspaceProvisioningError(
      "The selected workspace is not the reviewed public demo; no membership was changed.",
    );
  }

  if (existing?.role === PUBLIC_WORKSPACE_ROLE) {
    return {
      workspaceId,
      userId: PUBLIC_WORKSPACE_USER_ID,
      role: PUBLIC_WORKSPACE_ROLE,
      changed: false,
      verifiedConnectorCount,
      indexedDocumentCount,
    };
  }

  const result = await provisionPublicWorkspaceMembership(db, workspaceId);
  return {
    ...result,
    changed: true,
    verifiedConnectorCount,
    indexedDocumentCount,
  };
}
