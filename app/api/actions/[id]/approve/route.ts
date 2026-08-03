import { apiError, noStoreJson } from "../../../../../lib/server/api";
import { requirePrivateControlActor, requireRequestActor } from "../../../../../lib/server/identity";
import { requireDb, runtimeEnv } from "../../../../../lib/server/runtime";
import { audit, createId, ensureCoreSchema, requireWorkspaceForUser } from "../../../../../lib/server/store";
import { ProviderError, createIssue, type IssuePayload } from "../../../../../packages/actions/src";

/**
 * Record a human approval, then execute at most once.
 *
 * The double-approval guard is a UNIQUE(proposal_id) row in action_executions claimed
 * BEFORE the provider call. If two approvals race, one insert fails and that request
 * never reaches Linear — so a double click cannot create two issues. Guarding after the
 * call, or with a SELECT-then-INSERT, would leave exactly that gap.
 *
 * Nothing is reported as executed unless Linear returned an issue id.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRequestActor();
    requirePrivateControlActor(actor, "External provider execution");
    await ensureCoreSchema();
    const workspace = await requireWorkspaceForUser(actor.id);
    const workspaceId = String(workspace.id);
    const { id: proposalId } = await context.params;
    const db = requireDb();

    const membership = await db
      .prepare(`SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ? LIMIT 1`)
      .bind(workspaceId, actor.id)
      .first<{ role: string }>();
    if (membership?.role !== "owner") {
      return noStoreJson({ ok: false, error: "Only a workspace owner may approve provider execution." }, { status: 403 });
    }

    const proposal = await db
      .prepare(
        `SELECT id, provider, action_type AS actionType, payload_json AS payloadJson,
                evidence_ids_json AS evidenceIdsJson, status
         FROM action_proposals WHERE workspace_id = ? AND id = ? LIMIT 1`,
      )
      .bind(workspaceId, proposalId)
      .first<{ id: string; provider: string; actionType: string; payloadJson: string; evidenceIdsJson: string; status: string }>();

    if (!proposal) {
      return noStoreJson({ ok: false, error: "Proposal not found in this workspace." }, { status: 404 });
    }
    if (proposal.provider !== "linear" || proposal.actionType !== "create_issue") {
      return noStoreJson({ ok: false, error: "Only grounded Linear create-issue proposals can execute." }, { status: 409 });
    }
    let payload: IssuePayload;
    let evidenceIds: string[];
    try {
      payload = JSON.parse(proposal.payloadJson) as IssuePayload;
      evidenceIds = JSON.parse(proposal.evidenceIdsJson) as string[];
    } catch {
      return noStoreJson({ ok: false, error: "The stored proposal payload is invalid." }, { status: 409 });
    }
    if (
      typeof payload.title !== "string" || !payload.title.trim() || payload.title.length > 200 ||
      typeof payload.description !== "string" || !payload.description.trim() || payload.description.length > 10_000 ||
      typeof payload.teamId !== "string" || !payload.teamId.trim() || payload.teamId.length > 200 ||
      (payload.projectId !== undefined && (typeof payload.projectId !== "string" || payload.projectId.length > 200)) ||
      !Array.isArray(evidenceIds) || evidenceIds.length < 1 || evidenceIds.length > 50 ||
      evidenceIds.some((id) => typeof id !== "string" || id.length > 200 || !payload.description.includes(id))
    ) {
      return noStoreJson({ ok: false, error: "The stored proposal is outside the executable contract." }, { status: 409 });
    }
    const uniqueEvidenceIds = [...new Set(evidenceIds)];
    const ownedEvidence = await db
      .prepare(
        `SELECT id FROM source_references
         WHERE workspace_id = ? AND id IN (${uniqueEvidenceIds.map(() => "?").join(", ")})`,
      )
      .bind(workspaceId, ...uniqueEvidenceIds)
      .all<{ id: string }>();
    if (ownedEvidence.results.length !== uniqueEvidenceIds.length) {
      return noStoreJson({ ok: false, error: "Proposal evidence no longer resolves inside this workspace." }, { status: 409 });
    }

    const existingExecution = await db
      .prepare(
        `SELECT status, provider_response_id AS providerResponseId
         FROM action_executions WHERE proposal_id = ? LIMIT 1`,
      )
      .bind(proposalId)
      .first<{ status: string; providerResponseId: string | null }>();

    if (existingExecution) {
      return noStoreJson({
        ok: true,
        alreadyExecuted: true,
        executed: existingExecution.status === "succeeded",
        providerResponseId: existingExecution.providerResponseId,
        message: "This proposal has already been acted on; no second issue was created.",
      });
    }

    // Record the approval itself. UNIQUE(proposal_id) makes a repeat approval a no-op.
    await db
      .prepare(
        `INSERT OR IGNORE INTO action_approvals (id, workspace_id, proposal_id, decision, decided_by, decided_at)
         VALUES (?, ?, ?, 'approved', ?, CURRENT_TIMESTAMP)`,
      )
      .bind(createId("approval"), workspaceId, proposalId, actor.id)
      .run();

    await audit({
      workspaceId,
      actorId: actor.id,
      operation: "action.approve",
      targetType: "action_proposal",
      targetId: proposalId,
      outcome: "success",
      riskClass: "high",
    });

    const apiKey = (runtimeEnv() as Record<string, unknown>).LINEAR_API_KEY;
    if (typeof apiKey !== "string" || !apiKey) {
      return noStoreJson(
        {
          ok: true,
          approved: true,
          executed: false,
          message:
            "Approval recorded. Execution is not possible: LINEAR_API_KEY is not configured on this deployment.",
        },
        { status: 202 },
      );
    }

    // Claim the execution slot before calling the provider. A losing concurrent request
    // fails here and never reaches Linear.
    const executionId = createId("execution");
    try {
      await db
        .prepare(
          `INSERT INTO action_executions (id, workspace_id, proposal_id, status) VALUES (?, ?, ?, 'pending')`,
        )
        .bind(executionId, workspaceId, proposalId)
        .run();
    } catch {
      return noStoreJson({
        ok: true,
        alreadyExecuted: true,
        executed: false,
        message: "Another approval is already executing this proposal; no second issue was created.",
      });
    }

    try {
      const issue = await createIssue({ apiKey, payload });
      await db
        .prepare(
          `UPDATE action_executions SET status = 'succeeded', provider_response_id = ?,
           updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        )
        .bind(issue.id, executionId)
        .run();
      await db
        .prepare(`UPDATE action_proposals SET status = 'executed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .bind(proposalId)
        .run();
      await audit({
        workspaceId,
        actorId: actor.id,
        operation: "action.execute",
        targetType: "action_execution",
        targetId: executionId,
        outcome: "success",
        riskClass: "high",
        metadata: { provider: "linear", identifier: issue.identifier },
      });

      return noStoreJson({
        ok: true,
        approved: true,
        executed: true,
        issue,
        message: "Linear confirmed issue creation.",
      });
    } catch (error) {
      const message = error instanceof ProviderError ? error.message : "Linear execution failed.";
      await db
        .prepare(
          `UPDATE action_executions SET status = 'failed', error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        )
        .bind(message, executionId)
        .run();
      await audit({
        workspaceId,
        actorId: actor.id,
        operation: "action.execute",
        targetType: "action_execution",
        targetId: executionId,
        outcome: "failure",
        riskClass: "high",
        metadata: { provider: "linear" },
      });
      return noStoreJson({ ok: false, approved: true, executed: false, error: message }, { status: 502 });
    }
  } catch (error) {
    return apiError(error);
  }
}
