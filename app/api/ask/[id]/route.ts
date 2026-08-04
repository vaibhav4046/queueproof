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
      `SELECT receipt_json AS receiptJson, receipt_hash AS receiptHash,
              schema_version AS schemaVersion, created_at AS createdAt
       FROM query_receipts
       WHERE workspace_id = ? AND query_run_id = ? LIMIT 1`,
    ).bind(workspaceId, id).first<StoredReceipt>();
    if (!stored) {
      return noStoreJson({ ok: false, error: "Verified query receipt not found." }, { status: 404 });
    }
    const payload = JSON.parse(stored.receiptJson) as { workflow?: unknown; result?: unknown };
    const workflow = liveProofStateSchema.parse(payload.workflow);
    return noStoreJson({
      ok: true,
      workflow,
      result: payload.result,
      receiptHash: stored.receiptHash,
      schemaVersion: stored.schemaVersion,
      persistedAt: stored.createdAt,
    });
  } catch (error) {
    return apiError(error);
  }
}
