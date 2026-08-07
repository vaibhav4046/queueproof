import { apiError, noStoreJson } from "../../../../lib/server/api";
import { requireRequestActor } from "../../../../lib/server/identity";
import { requireDb } from "../../../../lib/server/runtime";
import { ensureCoreSchema, workspaceForUser } from "../../../../lib/server/store";
import { publicDtoForActor } from "../../../../lib/server/public-dto";

export async function GET() {
  try {
    const actor = await requireRequestActor();
    await ensureCoreSchema();
    const workspace = await workspaceForUser(actor.id);
    if (!workspace) return noStoreJson(publicDtoForActor(actor, { status: "not_configured", connectors: [] }));
    const result = await requireDb()
      .prepare(
        `SELECT provider, state, last_successful_sync_at, last_error
         FROM connectors WHERE workspace_id = ? AND state != 'deleted' ORDER BY provider`,
      )
      .bind(String(workspace.id))
      .all();
    return noStoreJson(publicDtoForActor(actor, { status: "observable", connectors: result.results }, {
      workspaceId: String(workspace.id),
    }));
  } catch (error) {
    return apiError(error);
  }
}
