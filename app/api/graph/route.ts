import { apiError, noStoreJson } from "../../../lib/server/api";
import { requireRequestActor } from "../../../lib/server/identity";
import { listQueueForWorkspace } from "../../../lib/server/queue";
import { requireWorkspaceForUser } from "../../../lib/server/store";
import { deriveGraphFromPacket, type EvidenceGraph } from "../../../packages/graph/src";
import type { ExecutionPacket } from "../../../packages/contracts/src";

// listQueueForWorkspace's row spread (`{...row, packet: JSON.parse(...), ...}`) is a
// plain `.map()` return; TypeScript does not carry the SQL-aliased column names
// (`tc.id AS taskId`) through it as an index signature. app/api/ask/route.ts hits the
// same gap and resolves it the same way: an explicit local shape plus one cast at the
// boundary, rather than fighting inference on every property access below.
type QueueItemShape = { taskId?: unknown; packet?: unknown };

/**
 * GET-only: derives the evidence graph from this workspace's most recent queue,
 * optionally scoped to one task via ?taskId=. No request body and no free-text or
 * external-URL input reaches this route, so assertSafeExternalUrl and
 * isPotentialPromptInjection do not apply here — everything read is already-stored,
 * workspace-scoped packet data (see ARCHITECTURE.md "Evidence graph").
 */
export async function GET(request: Request) {
  try {
    const actor = await requireRequestActor();
    const workspace = await requireWorkspaceForUser(actor.id);
    const workspaceId = String(workspace.id);
    const queue = await listQueueForWorkspace(workspaceId);
    const items = queue.items as unknown as QueueItemShape[];

    const requestedTaskId = new URL(request.url).searchParams.get("taskId");
    const scopedItems = requestedTaskId
      ? items.filter((item) => String(item.taskId) === requestedTaskId)
      : items;

    const graphs = scopedItems.map((item) =>
      deriveGraphFromPacket(item.packet as ExecutionPacket, String(item.taskId)),
    );
    const graph: EvidenceGraph = {
      nodes: graphs.flatMap((entry) => entry.nodes),
      edges: graphs.flatMap((entry) => entry.edges),
    };

    return noStoreJson({ ok: true, graph });
  } catch (error) {
    return apiError(error);
  }
}
