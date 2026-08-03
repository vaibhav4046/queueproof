import { apiError, noStoreJson } from "../../../lib/server/api";
import { requireRequestActor } from "../../../lib/server/identity";
import { generateQueueForWorkspace, listQueueForWorkspace } from "../../../lib/server/queue";
import { enforcePublicRateLimit, requireWorkspaceForUser } from "../../../lib/server/store";

export async function GET() {
  try {
    const actor = await requireRequestActor();
    const workspace = await requireWorkspaceForUser(actor.id);
    return noStoreJson({ ok: true, ...(await listQueueForWorkspace(String(workspace.id))) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST() {
  try {
    const actor = await requireRequestActor();
    const workspace = await requireWorkspaceForUser(actor.id);
    await enforcePublicRateLimit({
      actorId: actor.id,
      workspaceId: String(workspace.id),
      operation: "queue.generate",
      limit: 3,
      windowMs: 5 * 60_000,
    });
    return noStoreJson({ ok: true, ...(await generateQueueForWorkspace(String(workspace.id), actor.id)) });
  } catch (error) {
    return apiError(error);
  }
}
