import { apiError, noStoreJson } from "../../../lib/server/api";
import { requireRequestActor } from "../../../lib/server/identity";
import { generateQueueForWorkspace, listQueueForWorkspace } from "../../../lib/server/queue";
import { publicDtoForActor, publicStorageReference } from "../../../lib/server/public-dto";
import { enforcePublicRateLimit, requireWorkspaceForUser } from "../../../lib/server/store";

export async function GET() {
  try {
    const actor = await requireRequestActor();
    const workspace = await requireWorkspaceForUser(actor.id);
    const workspaceId = String(workspace.id);
    const queue = await listQueueForWorkspace(workspaceId);
    const referenceAliases = queue.items.flatMap((item) => {
      const row = item as Record<string, unknown>;
      return [
        typeof row.taskId === "string"
          ? { raw: row.taskId, public: publicStorageReference(workspaceId, "task", row.taskId) }
          : null,
        typeof row.packetId === "string"
          ? { raw: row.packetId, public: publicStorageReference(workspaceId, "packet", row.packetId) }
          : null,
      ].filter((entry): entry is { raw: string; public: string } => Boolean(entry));
    });
    return noStoreJson(publicDtoForActor(actor, { ok: true, ...queue }, { workspaceId, referenceAliases }));
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
    const workspaceId = String(workspace.id);
    const queue = await generateQueueForWorkspace(workspaceId, actor.id);
    const referenceAliases = queue.items.flatMap((item) => {
      const row = item as Record<string, unknown>;
      return [
        typeof row.taskId === "string"
          ? { raw: row.taskId, public: publicStorageReference(workspaceId, "task", row.taskId) }
          : null,
        typeof row.packetId === "string"
          ? { raw: row.packetId, public: publicStorageReference(workspaceId, "packet", row.packetId) }
          : null,
      ].filter((entry): entry is { raw: string; public: string } => Boolean(entry));
    });
    return noStoreJson(publicDtoForActor(actor, { ok: true, ...queue }, { workspaceId, referenceAliases }));
  } catch (error) {
    return apiError(error);
  }
}
