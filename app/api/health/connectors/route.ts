import { apiError, noStoreJson } from "../../../../lib/server/api";
import { requireRequestActor } from "../../../../lib/server/identity";
import { requireDb } from "../../../../lib/server/runtime";
import { ensureCoreSchema, workspaceForUser } from "../../../../lib/server/store";

export async function GET() {
  try {
    const actor = await requireRequestActor();
    await ensureCoreSchema();
    const workspace = await workspaceForUser(actor.id);
    if (!workspace) return noStoreJson({ status: "not_configured", connectors: [] });
    const result = await requireDb()
      .prepare(
        `SELECT provider, state, last_successful_sync_at, last_error
         FROM connectors WHERE workspace_id = ? ORDER BY provider`,
      )
      .bind(String(workspace.id))
      .all();
    return noStoreJson({ status: "observable", connectors: result.results });
  } catch (error) {
    return apiError(error);
  }
}

