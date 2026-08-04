import { apiError, noStoreJson } from "../../../../lib/server/api";
import { requireRequestActor } from "../../../../lib/server/identity";
import { requireDb } from "../../../../lib/server/runtime";
import { ensureCoreSchema, requireWorkspaceForUser } from "../../../../lib/server/store";
import { liveProofStateSchema } from "../../../../packages/contracts/src";

type StoredReceipt = {
  receiptJson: string;
  receiptHash: string;
  schemaVersion: string;
  createdAt: string;
  question: string;
};

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRequestActor();
    const workspace = await requireWorkspaceForUser(actor.id);
    const workspaceId = String(workspace.id);
    const { id } = await context.params;
    if (!/^[a-z0-9_-]{8,160}$/i.test(id)) {
      return noStoreJson({ ok: false, error: "Query receipt ID is invalid." }, { status: 400 });
    }
    await ensureCoreSchema();
    const stored = await requireDb().prepare(
      `SELECT receipts.receipt_json AS receiptJson, receipts.receipt_hash AS receiptHash,
              receipts.schema_version AS schemaVersion, receipts.created_at AS createdAt,
              runs.sanitised_query AS question
       FROM query_receipts AS receipts
       JOIN query_runs AS runs
         ON runs.workspace_id = receipts.workspace_id AND runs.id = receipts.query_run_id
       WHERE receipts.workspace_id = ? AND receipts.query_run_id = ? LIMIT 1`,
    ).bind(workspaceId, id).first<StoredReceipt>();
    if (!stored) {
      return noStoreJson({ ok: false, error: "Verified query receipt not found." }, { status: 404 });
    }
    const payload = JSON.parse(stored.receiptJson) as { workflow?: unknown; result?: unknown };
    const workflow = liveProofStateSchema.parse(payload.workflow);
    const result = typeof payload.result === "object" && payload.result !== null
      ? { ...(payload.result as Record<string, unknown>), question: (payload.result as Record<string, unknown>).question ?? stored.question }
      : payload.result;
    return noStoreJson({
      ok: true,
      workflow,
      result,
      receiptHash: stored.receiptHash,
      schemaVersion: stored.schemaVersion,
      persistedAt: stored.createdAt,
    });
  } catch (error) {
    return apiError(error);
  }
}
