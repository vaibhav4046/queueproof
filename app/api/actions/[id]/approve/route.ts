import { apiError, noStoreJson } from "../../../../../lib/server/api";
import { requireRequestActor } from "../../../../../lib/server/identity";
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
    await ensureCoreSchema();
    const workspace = await requireWorkspaceForUser(actor.id);
    const workspaceId = String(workspace.id);
    const { id: proposalId } = await context.params;
    const db = requireDb();

    const proposal = await db
      .prepare(
        `SELECT id, payload_json AS payloadJson, evidence_ids_json AS evidenceIdsJson, status
         FROM action_proposals WHERE workspace_id = ? AND id = ? LIMIT 1`,
      )
      .bind(workspaceId, proposalId)
      .first<{ id: string; payloadJson: string; evidenceIdsJson: string; status: string }>();

    if (!proposal) {
      return noStoreJson({ ok: false, error: "Proposal not found in this workspace." }, { status: 404 });
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

    const payload = JSON.parse(proposal.payloadJson) as IssuePayload;
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
