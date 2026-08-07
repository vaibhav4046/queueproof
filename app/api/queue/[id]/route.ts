import { apiError, noStoreJson } from "../../../../lib/server/api";
import { requireRequestActor } from "../../../../lib/server/identity";
import { executionPacketForWorkspace } from "../../../../lib/server/queue";
import {
  isPublicAccessActor,
  publicDtoForActor,
  publicStorageReference,
} from "../../../../lib/server/public-dto";
import { requireDb } from "../../../../lib/server/runtime";
import { requireWorkspaceForUser } from "../../../../lib/server/store";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRequestActor();
    const workspace = await requireWorkspaceForUser(actor.id);
    const workspaceId = String(workspace.id);
    const { id } = await context.params;
    let packetId = id;
    if (isPublicAccessActor(actor) && id.startsWith("public-packet-")) {
      const candidates = await requireDb().prepare(
        `SELECT id FROM execution_packets WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 500`,
      ).bind(workspaceId).all<{ id: string }>();
      packetId = candidates.results.find((candidate) =>
        publicStorageReference(workspaceId, "packet", candidate.id) === id)?.id ?? "";
    }
    const packet = packetId ? await executionPacketForWorkspace(workspaceId, packetId) : null;
    if (!packet) return noStoreJson({ ok: false, error: "Execution packet not found." }, { status: 404 });
    return noStoreJson(publicDtoForActor(actor, { ok: true, packet }, {
      workspaceId,
      referenceAliases: [{ raw: packetId, public: publicStorageReference(workspaceId, "packet", packetId) }],
    }));
  } catch (error) {
    return apiError(error);
  }
}
