import { apiError, noStoreJson } from "../../../../lib/server/api";
import { requireRequestActor } from "../../../../lib/server/identity";
import { executionPacketForWorkspace } from "../../../../lib/server/queue";
import { requireWorkspaceForUser } from "../../../../lib/server/store";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRequestActor();
    const workspace = await requireWorkspaceForUser(actor.id);
    const { id } = await context.params;
    const packet = await executionPacketForWorkspace(String(workspace.id), id);
    if (!packet) return noStoreJson({ ok: false, error: "Execution packet not found." }, { status: 404 });
    return noStoreJson({ ok: true, packet });
  } catch (error) {
    return apiError(error);
  }
}
