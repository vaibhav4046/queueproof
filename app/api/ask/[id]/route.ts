import { apiError, noStoreJson } from "../../../../lib/server/api";
import { requireRequestActor } from "../../../../lib/server/identity";
import { requireDb } from "../../../../lib/server/runtime";
import { ensureCoreSchema, requireWorkspaceForUser } from "../../../../lib/server/store";
import { liveProofStateSchema } from "../../../../packages/contracts/src";
import {
  isPublicAccessActor,
  publicDtoForActor,
  publicQueryReference,
} from "../../../../lib/server/public-dto";

type StoredReceipt = {
  receiptJson: string;
  receiptHash: string;
  schemaVersion: string;
  createdAt: string;
  question: string;
};

async function storedQueryIdForPublicReference(workspaceId: string, reference: string): Promise<string | null> {
  if (!reference.startsWith("public-query-")) return reference;
  const rows = await requireDb().prepare(
    `SELECT id FROM query_runs WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 500`,
  ).bind(workspaceId).all<{ id: string }>();
  for (const row of rows.results) {
    if (await publicQueryReference(workspaceId, row.id) === reference) return row.id;
  }
  return null;
}

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
    const storedQueryId = isPublicAccessActor(actor)
      ? await storedQueryIdForPublicReference(workspaceId, id)
      : id;
    if (!storedQueryId) {
      return noStoreJson({ ok: false, error: "Verified query receipt not found." }, { status: 404 });
    }
    const stored = await requireDb().prepare(
      `SELECT receipts.receipt_json AS receiptJson, receipts.receipt_hash AS receiptHash,
              receipts.schema_version AS schemaVersion, receipts.created_at AS createdAt,
              runs.sanitised_query AS question
       FROM query_receipts AS receipts
       JOIN query_runs AS runs
         ON runs.workspace_id = receipts.workspace_id AND runs.id = receipts.query_run_id
       WHERE receipts.workspace_id = ? AND receipts.query_run_id = ? LIMIT 1`,
    ).bind(workspaceId, storedQueryId).first<StoredReceipt>();
    if (!stored) {
      return noStoreJson({ ok: false, error: "Verified query receipt not found." }, { status: 404 });
    }
    const payload = JSON.parse(stored.receiptJson) as { workflow?: unknown; result?: unknown };
    const workflow = liveProofStateSchema.parse(payload.workflow);
    const result = typeof payload.result === "object" && payload.result !== null
      ? { ...(payload.result as Record<string, unknown>), question: (payload.result as Record<string, unknown>).question ?? stored.question }
      : payload.result;
    const publicQueryId = isPublicAccessActor(actor)
      ? await publicQueryReference(workspaceId, storedQueryId)
      : storedQueryId;
    return noStoreJson(publicDtoForActor(actor, {
      ok: true,
      workflow,
      result,
      receiptHash: stored.receiptHash,
      schemaVersion: stored.schemaVersion,
      persistedAt: stored.createdAt,
    }, {
      workspaceId,
      referenceAliases: [{ raw: storedQueryId, public: publicQueryId }],
    }));
  } catch (error) {
    return apiError(error);
  }
}
