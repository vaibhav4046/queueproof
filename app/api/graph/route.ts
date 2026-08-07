import { apiError, noStoreJson } from "../../../lib/server/api";
import { requireRequestActor } from "../../../lib/server/identity";
import { listQueueForWorkspace } from "../../../lib/server/queue";
import { requireDb } from "../../../lib/server/runtime";
import { requireWorkspaceForUser } from "../../../lib/server/store";
import { deriveGraphFromConnectors, deriveGraphFromPacket, type EvidenceGraph } from "../../../packages/graph/src";
import type { ExecutionPacket } from "../../../packages/contracts/src";
import {
  isPublicAccessActor,
  publicDtoForActor,
  publicStorageReference,
} from "../../../lib/server/public-dto";

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

    const requestedTaskReference = new URL(request.url).searchParams.get("taskId");
    const requestedTaskId = requestedTaskReference && isPublicAccessActor(actor) &&
      requestedTaskReference.startsWith("public-task-")
      ? items.find((item) => typeof item.taskId === "string" &&
        publicStorageReference(workspaceId, "task", item.taskId) === requestedTaskReference)?.taskId
      : requestedTaskReference;
    const scopedItems = requestedTaskReference
      ? requestedTaskId
        ? items.filter((item) => String(item.taskId) === requestedTaskId)
        : []
      : items;

    const graphs = scopedItems.map((item) =>
      deriveGraphFromPacket(item.packet as ExecutionPacket, String(item.taskId)),
    );

    // Connector nodes and ORIGINATED_FROM edges are workspace-wide, not per-task, so
    // they are derived once from the real connectors/source_references tables and
    // merged in — not from the packet-derived source nodes above, which carry no
    // connector_id (sourceReferenceSchema doesn't have that field; only the raw
    // source_references table row does).
    const db = requireDb();
    const [connectorRows, sourceRows] = await Promise.all([
      db
        .prepare(
          `SELECT id, provider, name, state, database, collection,
                  last_successful_sync_at AS lastSuccessfulSyncAt, last_error AS lastError
           FROM connectors WHERE workspace_id = ? AND state != 'deleted'`,
        )
        .bind(workspaceId)
        .all(),
      db
        .prepare(
          `SELECT id, provider, title, excerpt, source_url AS url,
                  source_timestamp AS timestamp, authority, connector_id AS connectorId
           FROM source_references WHERE workspace_id = ?`,
        )
        .bind(workspaceId)
        .all(),
    ]);
    const connectorGraph = deriveGraphFromConnectors(connectorRows.results ?? [], sourceRows.results ?? []);

    const packetNodes = graphs.flatMap((entry) => entry.nodes);
    const packetEdges = graphs.flatMap((entry) => entry.edges);
    // deriveGraphFromConnectors re-derives `source` nodes from source_references
    // independently of the packet-derived ones above (same `source:${id}` scheme);
    // keep the packet version (it carries claim/task context) and only add the
    // connector nodes plus edges pointing at sources the packet graph already has.
    const knownNodeIds = new Set(packetNodes.map((node) => node.id));
    const newConnectorNodes = connectorGraph.nodes.filter(
      (node) => node.type === "connector" && !knownNodeIds.has(node.id),
    );
    const relevantConnectorEdges = connectorGraph.edges.filter((edge) => knownNodeIds.has(edge.source));

    const graph: EvidenceGraph = {
      nodes: [...packetNodes, ...newConnectorNodes],
      edges: [...packetEdges, ...relevantConnectorEdges],
    };

    return noStoreJson(publicDtoForActor(actor, { ok: true, graph }, { workspaceId }));
  } catch (error) {
    return apiError(error);
  }
}
