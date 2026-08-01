import { apiError, noStoreJson } from "../../../../../lib/server/api";
import { requireRequestActor } from "../../../../../lib/server/identity";
import { requireDb } from "../../../../../lib/server/runtime";
import { createId, ensureCoreSchema, requireWorkspaceForUser } from "../../../../../lib/server/store";
import { hydraClientForWorkspace } from "../../../../../lib/server/hydradb-account";

/**
 * Poll HydraDB for one document's real indexing state and advance the stored stage.
 *
 * HydraDB's ingest returns 202 (queued), and indexing then moves through states such as
 * graph_creation before reaching a terminal one. The stage recorded here is whatever
 * HydraDB actually reports — it is never advanced optimistically, because a document
 * marked indexed that is not yet queryable is worse than one still marked processing.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRequestActor();
    await ensureCoreSchema();
    const workspace = await requireWorkspaceForUser(actor.id);
    const workspaceId = String(workspace.id);
    const { id } = await context.params;
    const db = requireDb();

    const document = await db
      .prepare(
        `SELECT id, filename, stage, hydradb_source_id AS sourceId
         FROM documents WHERE workspace_id = ? AND id = ? LIMIT 1`,
      )
      .bind(workspaceId, id)
      .first<{ id: string; filename: string; stage: string; sourceId: string | null }>();

    if (!document) {
      return noStoreJson({ ok: false, error: "Document not found in this workspace." }, { status: 404 });
    }
    if (!document.sourceId) {
      return noStoreJson({
        ok: true,
        document,
        indexingStatus: null,
        message: "This document was never accepted by HydraDB, so it has no indexing state.",
      });
    }

    const database = String(workspace.slug || workspaceId);
    const client = await hydraClientForWorkspace(workspaceId);
    const status = await client.contextStatus(database, document.sourceId);

    if (!status.ok) {
      return noStoreJson({ ok: false, error: status.error ?? "Status check failed." }, { status: 502 });
    }

    // The field name is reported by HydraDB; look for it without assuming nesting depth.
    const raw = JSON.stringify(status.data ?? {});
    const match = raw.match(/"indexing_status"\s*:\s*"([a-z_]+)"/i);
    const indexingStatus = match ? match[1] : null;

    const stage =
      indexingStatus === "completed"
        ? "indexed"
        : indexingStatus && /error|fail/i.test(indexingStatus)
          ? "failed"
          : "processing";

    if (stage !== document.stage) {
      await db
        .prepare(`UPDATE documents SET stage = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .bind(stage, document.id)
        .run();
      await db
        .prepare(
          `INSERT INTO document_ingestion_runs (id, workspace_id, document_id, stage, detail)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(createId("ingest"), workspaceId, document.id, stage, indexingStatus ?? "unknown")
        .run();
    }

    return noStoreJson({
      ok: true,
      document: { ...document, stage },
      indexingStatus,
      terminal: stage === "indexed" || stage === "failed",
    });
  } catch (error) {
    return apiError(error);
  }
}
