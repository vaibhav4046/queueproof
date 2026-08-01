import { apiError, noStoreJson, readJson } from "../../../lib/server/api";
import { requireRequestActor } from "../../../lib/server/identity";
import { requireDb } from "../../../lib/server/runtime";
import { audit, createId, ensureCoreSchema, requireWorkspaceForUser } from "../../../lib/server/store";
import {
  buildIssuePayload,
  idempotencyKeyFor,
  riskClass,
  type Commitment,
} from "../../../packages/actions/src";

/** List proposals with their approval and execution state. */
export async function GET() {
  try {
    const actor = await requireRequestActor();
    await ensureCoreSchema();
    const workspace = await requireWorkspaceForUser(actor.id);
    const rows = await requireDb()
      .prepare(
        `SELECT ap.id, ap.provider, ap.action_type AS actionType, ap.payload_json AS payloadJson,
                ap.evidence_ids_json AS evidenceIdsJson, ap.risk_class AS riskClass,
                ap.status, ap.created_at AS createdAt,
                aa.decision, aa.decided_at AS decidedAt,
                ax.status AS executionStatus, ax.provider_response_id AS providerResponseId
         FROM action_proposals ap
         LEFT JOIN action_approvals aa ON aa.proposal_id = ap.id
         LEFT JOIN action_executions ax ON ax.proposal_id = ap.id
         WHERE ap.workspace_id = ? ORDER BY ap.created_at DESC LIMIT 50`,
      )
      .bind(String(workspace.id))
      .all();
    return noStoreJson({ ok: true, proposals: rows.results });
  } catch (error) {
    return apiError(error);
  }
}

/**
 * Propose an approval-gated provider write.
 *
 * This never executes anything. It records exactly what would be sent, with the evidence
 * that justifies it, so a human approves a concrete payload rather than an intention.
 *
 * At least one evidence id is required. An action QueueProof cannot ground in a source
 * is precisely the thing this product exists to prevent, so it is rejected outright
 * rather than recorded with a warning.
 */
export async function POST(request: Request) {
  try {
    const actor = await requireRequestActor();
    await ensureCoreSchema();
    const workspace = await requireWorkspaceForUser(actor.id);
    const workspaceId = String(workspace.id);

    const body = await readJson<{
      commitment?: Partial<Commitment>;
      teamId?: string;
      projectId?: string;
    }>(request);

    const commitment = body.commitment ?? {};
    const evidenceIds = Array.isArray(commitment.evidenceIds)
      ? commitment.evidenceIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      : [];

    if (evidenceIds.length === 0) {
      return noStoreJson(
        { ok: false, error: "An action proposal must cite at least one evidence source." },
        { status: 400 },
      );
    }
    if (typeof commitment.summary !== "string" || !commitment.summary.trim()) {
      return noStoreJson({ ok: false, error: "The commitment summary is required." }, { status: 400 });
    }
    if (typeof body.teamId !== "string" || !body.teamId.trim()) {
      return noStoreJson({ ok: false, error: "A Linear team id is required." }, { status: 400 });
    }

    const resolved: Commitment = {
      id: typeof commitment.id === "string" && commitment.id ? commitment.id : createId("commitment"),
      summary: commitment.summary,
      owner: typeof commitment.owner === "string" ? commitment.owner : null,
      deadline: typeof commitment.deadline === "string" ? commitment.deadline : null,
      customer: typeof commitment.customer === "string" ? commitment.customer : null,
      evidenceIds,
      sourceProvider: typeof commitment.sourceProvider === "string" ? commitment.sourceProvider : "unknown",
    };

    const payload = buildIssuePayload(resolved, body.teamId, body.projectId);
    const key = await idempotencyKeyFor(workspaceId, resolved.id, payload);
    const db = requireDb();

    // Replaying the same proposal must collapse onto the existing row. Double-clicking
    // approve must never yield two issues, and that starts here.
    const existing = await db
      .prepare(`SELECT id, status FROM action_proposals WHERE workspace_id = ? AND idempotency_key = ? LIMIT 1`)
      .bind(workspaceId, key)
      .first<{ id: string; status: string }>();

    if (existing) {
      return noStoreJson({
        ok: true,
        replayed: true,
        proposalId: existing.id,
        status: existing.status,
        approvalRequired: true,
        payload,
      });
    }

    const proposalId = createId("action");
    await db
      .prepare(
        `INSERT INTO action_proposals
         (id, workspace_id, provider, action_type, payload_json, evidence_ids_json,
          risk_class, idempotency_key, status)
         VALUES (?, ?, 'linear', 'create_issue', ?, ?, ?, ?, 'proposed')`,
      )
      .bind(
        proposalId,
        workspaceId,
        JSON.stringify(payload),
        JSON.stringify(evidenceIds),
        riskClass(payload, resolved),
        key,
      )
      .run();

    await audit({
      workspaceId,
      actorId: actor.id,
      operation: "action.propose",
      targetType: "action_proposal",
      targetId: proposalId,
      outcome: "success",
      riskClass: "write",
      metadata: { provider: "linear", evidenceCount: evidenceIds.length },
    });

    return noStoreJson(
      {
        ok: true,
        replayed: false,
        proposalId,
        status: "proposed",
        approvalRequired: true,
        riskClass: riskClass(payload, resolved),
        payload,
        evidenceIds,
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
