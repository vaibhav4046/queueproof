import { apiError, noStoreJson, readJson } from "../../../lib/server/api";
import { requireRequestActor } from "../../../lib/server/identity";
import { requireDb } from "../../../lib/server/runtime";
import { audit, createId, enforcePublicRateLimit, ensureCoreSchema, requireWorkspaceForUser } from "../../../lib/server/store";
import {
  buildIssuePayload,
  idempotencyKeyFor,
  riskClass,
  type Commitment,
} from "../../../packages/actions/src";
import { isPotentialPromptInjection } from "../../../packages/security/src";

const MAX_SUMMARY = 4_000;
const MAX_FIELD = 200;
const MAX_EVIDENCE_IDS = 50;

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
                ax.status AS executionStatus, ax.provider_response_id AS providerResponseId,
                ax.error AS executionError
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
    await enforcePublicRateLimit({
      actorId: actor.id, workspaceId, operation: "action.propose", limit: 8, windowMs: 10 * 60_000,
    });
    if (actor.id === "user:public-access") {
      const pendingPublic = await requireDb()
        .prepare(`SELECT COUNT(*) AS total FROM action_proposals WHERE workspace_id = ? AND status = 'proposed'`)
        .bind(workspaceId)
        .first<{ total: number }>();
      if (Number(pendingPublic?.total ?? 0) >= 50) {
        return noStoreJson(
          { ok: false, error: "The public proposal ledger is full. A workspace owner must review it before more proposals are accepted." },
          { status: 429 },
        );
      }
    }

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
    if (evidenceIds.length > MAX_EVIDENCE_IDS || evidenceIds.some((id) => id.length > MAX_FIELD)) {
      return noStoreJson({ ok: false, error: "Too many or oversized evidence references." }, { status: 400 });
    }
    const uniqueEvidenceIds = [...new Set(evidenceIds)];
    const db = requireDb();
    const ownedEvidence = await db
      .prepare(
        `SELECT id FROM source_references WHERE workspace_id = ? AND id IN (${uniqueEvidenceIds.map(() => "?").join(", ")})`,
      )
      .bind(workspaceId, ...uniqueEvidenceIds)
      .all<{ id: string }>();
    if (ownedEvidence.results.length !== uniqueEvidenceIds.length) {
      return noStoreJson(
        { ok: false, error: "Every action reference must be evidence stored in this workspace." },
        { status: 400 },
      );
    }
    if (typeof commitment.summary !== "string" || !commitment.summary.trim()) {
      return noStoreJson({ ok: false, error: "The commitment summary is required." }, { status: 400 });
    }
    // Bounded before anything is stored. Without this a single request could persist a
    // multi-megabyte row and, worse, carry it into a provider write.
    if (commitment.summary.length > MAX_SUMMARY) {
      return noStoreJson(
        { ok: false, error: `The commitment summary must be ${MAX_SUMMARY} characters or fewer.` },
        { status: 400 },
      );
    }
    if (typeof body.teamId !== "string" || !body.teamId.trim() || body.teamId.length > MAX_FIELD) {
      return noStoreJson({ ok: false, error: "A valid Linear team id is required." }, { status: 400 });
    }
    for (const [name, value] of [
      ["owner", commitment.owner],
      ["customer", commitment.customer],
      ["deadline", commitment.deadline],
      ["sourceProvider", commitment.sourceProvider],
    ] as const) {
      if (typeof value === "string" && value.length > MAX_FIELD) {
        return noStoreJson({ ok: false, error: `The ${name} field is too long.` }, { status: 400 });
      }
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

    // The summary originates in retrieved source content, and this proposal is the path
    // by which that content would reach a provider write. Screen it: instructions
    // embedded in evidence are data, never commands, so a hit does not block the
    // proposal but does force the highest risk class and is surfaced to the approver.
    const injectionSuspected = isPotentialPromptInjection(resolved.summary);
    const risk = injectionSuspected ? "critical" : riskClass(payload, resolved);

    const key = await idempotencyKeyFor(workspaceId, resolved.id, payload);
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
        risk,
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
      metadata: {
        provider: "linear",
        evidenceCount: evidenceIds.length,
        riskClass: risk,
        injectionSuspected,
      },
    });

    return noStoreJson(
      {
        ok: true,
        replayed: false,
        proposalId,
        status: "proposed",
        approvalRequired: true,
        riskClass: risk,
        payload,
        evidenceIds,
        injectionSuspected,
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
