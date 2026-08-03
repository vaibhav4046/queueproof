import { apiError, noStoreJson, readJson } from "../../../lib/server/api";
import { requirePrivateControlActor, requireRequestActor } from "../../../lib/server/identity";
import { requireDb, runtimeEnv } from "../../../lib/server/runtime";
import {
  audit,
  createId,
  ensureCoreSchema,
  workspaceForUser,
} from "../../../lib/server/store";
import { loadWorkspaceView } from "../../../lib/server/workspace-state";

/**
 * Returns the same discriminated view the server-rendered page uses, so a client refresh
 * can never disagree with the HTML it hydrated into. Unauthenticated callers get the
 * `sign_in_required` view rather than a 401, because this endpoint's job is to describe
 * which screen to show — the routes that actually touch workspace data still fail closed.
 */
export async function GET() {
  try {
    const view = await loadWorkspaceView();
    return noStoreJson({ ok: true, view });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!runtimeEnv().DB) {
      return noStoreJson(
        { ok: false, error: "Durable workspace storage is not configured on this deployment." },
        { status: 503 },
      );
    }
    const actor = await requireRequestActor();
    requirePrivateControlActor(actor, "Workspace creation");
    const payload = await readJson<{ name?: string }>(request);
    const name = payload.name?.trim() ?? "";
    if (name.length < 2 || name.length > 80) {
      return noStoreJson({ ok: false, error: "Workspace name must be 2–80 characters." }, { status: 400 });
    }
    await ensureCoreSchema();
    const existing = await workspaceForUser(actor.id);
    if (existing) return noStoreJson({ ok: false, error: "A workspace already exists for this account." }, { status: 409 });
    const db = requireDb();
    const workspaceId = createId("ws");
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)}-${workspaceId.slice(-6)}`;
    await db.batch([
      db
        .prepare(`INSERT OR IGNORE INTO users (id, email, display_name) VALUES (?, ?, ?)`)
        .bind(actor.id, actor.email, actor.displayName),
      db
        .prepare(`INSERT INTO workspaces (id, slug, name) VALUES (?, ?, ?)`)
        .bind(workspaceId, slug, name),
      db
        .prepare(
          `INSERT INTO workspace_members (id, workspace_id, user_id, role) VALUES (?, ?, ?, 'owner')`,
        )
        .bind(createId("member"), workspaceId, actor.id),
    ]);
    await audit({
      workspaceId,
      actorId: actor.id,
      operation: "workspace.create",
      targetType: "workspace",
      targetId: workspaceId,
      outcome: "success",
      riskClass: "write",
    });
    return noStoreJson({ ok: true, workspace: { id: workspaceId, name, slug } }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
