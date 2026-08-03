import { describe, expect, it } from "vitest";
import {
  attachUnambiguousDocumentEvidence,
  canEmitQueueScore,
  canOriginateQueueTask,
  clusterTaskEvidence,
  extractActionableTaskSpan,
  isHydraDocumentSource,
  queueSupportingEvidence,
  selectPrimaryQueueEvidence,
  taskClusterKey,
} from "../lib/server/queue";

const evidence = (provider: string, externalId: string, title: string, excerpt: string) => ({
  provider, externalId, title, excerpt,
});

describe("conservative cross-source task clustering", () => {
  it("joins an exact issue identity across providers", () => {
    expect(taskClusterKey(evidence("slack", "m1", "Escalation", "Engineering is fixing BUG-123 today.")))
      .toBe(taskClusterKey(evidence("linear", "i1", "BUG-123", "Issue remains in progress.")));
  });

  it("attaches an ID-less entity record when exactly one exact-ID component matches", () => {
    const groups = clusterTaskEvidence([
      evidence("linear", "i1", "AuthShield incident INC-2031", "Customer access is blocked."),
      evidence("slack", "m2", "Customer escalation", "AuthShield is blocking sign-in."),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(2);

    const wordingGroups = clusterTaskEvidence([
      {
        ...evidence("github", "issue-2031", "Post-mortem doc for INC-2031 Northwind outage", "Tracked work."),
        taskSpan: "Vaibhav promised Northwind a written incident post-mortem by 10 August 2026.",
      },
      {
        ...evidence("slack", "message-2031", "Northwind follow-up", "Original message."),
        taskSpan: "I promised Northwind a written incident post-mortem by 10 August.",
      },
    ]);
    expect(wordingGroups).toHaveLength(1);
    expect(wordingGroups[0]).toHaveLength(2);

    const wordingBeatsBroadEntityAmbiguityGroups = clusterTaskEvidence([
      {
        ...evidence("github", "issue-wording-target", "Post-mortem doc for INC-2031 Northwind outage", "Tracked work."),
        taskSpan: "Vaibhav promised Northwind a written incident post-mortem by 10 August 2026.",
      },
      {
        ...evidence("linear", "issue-broad-entity", "ENG-456 Northwind access cleanup", "Northwind access remains open."),
        taskSpan: "ENG-456 remains open and blocks Northwind access.",
      },
      {
        ...evidence("slack", "message-wording-target", "I promised Northwind a written incident post-mortem by 10 August. There is no Linear issue", "Original message."),
        taskSpan: "I promised Northwind a written incident post-mortem by 10 August.",
      },
    ]);
    expect(wordingBeatsBroadEntityAmbiguityGroups).toHaveLength(2);
    expect(wordingBeatsBroadEntityAmbiguityGroups.map((group) => group.length).sort()).toEqual([1, 2]);

    const differentCustomerGroups = clusterTaskEvidence([
      {
        ...evidence("github", "issue-2031", "Post-mortem doc for INC-2031", "Tracked work."),
        taskSpan: "Vaibhav promised Northwind a written incident post-mortem by 10 August 2026.",
      },
      {
        ...evidence("slack", "message-other", "Customer follow-up", "Original message."),
        taskSpan: "Vaibhav promised Contoso a written incident post-mortem by 10 August.",
      },
    ]);
    expect(differentCustomerGroups).toHaveLength(2);

    const genericOpenerGroups = clusterTaskEvidence([
      {
        ...evidence("github", "issue-northwind", "Incident INC-2031", "Tracked work."),
        taskSpan: "Please prepare the written incident post-mortem for Northwind by 10 August 2026.",
      },
      {
        ...evidence("slack", "message-contoso", "Customer follow-up", "Original message."),
        taskSpan: "Please prepare the written incident post-mortem for Contoso by 10 August 2026.",
      },
    ]);
    expect(genericOpenerGroups).toHaveLength(2);

    const stateOnlyCustomerGroups = clusterTaskEvidence([
      {
        ...evidence("github", "issue-state", "Access request INC-2031", "Tracked work."),
        taskSpan: "The Northwind access request remains open.",
      },
      {
        ...evidence("slack", "message-state", "Access follow-up", "Original message."),
        taskSpan: "The Contoso access request remains open.",
      },
    ]);
    expect(stateOnlyCustomerGroups).toHaveLength(2);

    const lowercaseCustomerGroups = clusterTaskEvidence([
      {
        ...evidence("github", "issue-lowercase", "Access request INC-2031", "Tracked work."),
        taskSpan: "Customer access request remains open for northwind.",
      },
      {
        ...evidence("slack", "message-lowercase", "Access follow-up", "Original message."),
        taskSpan: "Customer access request remains open for contoso.",
      },
    ]);
    expect(lowercaseCustomerGroups).toHaveLength(2);

    const billingCustomerGroups = clusterTaskEvidence([
      {
        ...evidence("github", "issue-billing", "Billing renewal INC-2031", "Tracked work."),
        taskSpan: "Billing renewal request remains open for northwind account.",
      },
      {
        ...evidence("slack", "message-billing", "Billing renewal", "Original message."),
        taskSpan: "Billing renewal request remains open for contoso account.",
      },
    ]);
    expect(billingCustomerGroups).toHaveLength(2);

    const multiCustomerGroups = clusterTaskEvidence([
      {
        ...evidence("github", "issue-multi", "Incident INC-2031", "Tracked work."),
        taskSpan: "We promised Northwind a written incident post-mortem by 10 August 2026.",
      },
      {
        ...evidence("slack", "message-multi", "Customer follow-up", "Original message."),
        taskSpan: "We promised Northwind and Contoso a written incident post-mortem by 10 August 2026.",
      },
    ]);
    expect(multiCustomerGroups).toHaveLength(2);

    const annualRenewalGroups = clusterTaskEvidence([
      {
        ...evidence("github", "issue-annual", "Renewal INC-2031", "Tracked work."),
        taskSpan: "Annual renewal request remains open for Northwind account 2026.",
      },
      {
        ...evidence("slack", "message-annual", "Annual renewal", "Original message."),
        taskSpan: "Annual renewal request remains open for Northwind account 2027.",
      },
    ]);
    expect(annualRenewalGroups).toHaveLength(2);

    const conjunctiveActorGroups = clusterTaskEvidence([
      {
        ...evidence("github", "issue-conjunctive", "Incident INC-2031", "Tracked work."),
        taskSpan: "Northwind and Contoso will prepare a written incident post-mortem by 10 August 2026.",
      },
      {
        ...evidence("slack", "message-conjunctive", "Northwind follow-up", "Original message."),
        taskSpan: "Northwind will prepare a written incident post-mortem by 10 August 2026.",
      },
    ]);
    expect(conjunctiveActorGroups).toHaveLength(2);

    const conflictingTitleScopeGroups = clusterTaskEvidence([
      {
        ...evidence("github", "issue-title-scope", "Northwind incident INC-2031", "Tracked work."),
        taskSpan: "Please prepare the written incident post-mortem by 10 August 2026.",
      },
      {
        ...evidence("slack", "message-title-scope", "Contoso follow-up", "Original message."),
        taskSpan: "Please prepare the written incident post-mortem by 10 August 2026.",
      },
    ]);
    expect(conflictingTitleScopeGroups).toHaveLength(2);

    const sharedActorConflictingCustomerGroups = clusterTaskEvidence([
      {
        ...evidence("github", "issue-shared-actor-scope", "Alice Northwind incident INC-2031", "Tracked work."),
        taskSpan: "Alice will prepare the written incident post-mortem by 10 August 2026.",
      },
      {
        ...evidence("slack", "message-shared-actor-scope", "Alice Contoso follow-up", "Original message."),
        taskSpan: "Alice will prepare the written incident post-mortem by 10 August 2026.",
      },
    ]);
    expect(sharedActorConflictingCustomerGroups).toHaveLength(2);

    const subsetIdentityGroups = clusterTaskEvidence([
      {
        ...evidence("github", "issue-subset", "Incident INC-2031", "Tracked work."),
        taskSpan: "We promised Northwind a written AuthShield incident post-mortem by 10 August 2026.",
      },
      {
        ...evidence("slack", "message-subset", "Northwind follow-up", "Original message."),
        taskSpan: "We promised Northwind a written incident post-mortem by 10 August 2026.",
      },
    ]);
    expect(subsetIdentityGroups).toHaveLength(1);
  });

  it("never merges disjoint exact-ID sets through a shared entity name", () => {
    const workplaceGroups = clusterTaskEvidence([
      { ...evidence("linear", "i1", "AuthShield incident INC-2031", "Customer access is blocked."), taskSpan: "INC-2031 remains open and blocks customer access." },
      { ...evidence("github", "p2", "AuthShield issue ENG-456", "Token lifetime work is open."), taskSpan: "Engineering committed to ENG-456 by Friday." },
    ]);
    expect(workplaceGroups).toHaveLength(2);

    const documentBridge = {
      ...evidence(
        "document",
        "handbook#chunk-41",
        "helios-operations-handbook.pdf",
        "Reference table: ENG-456 and INC-2031.",
      ),
      taskSpan: "Reference table: ENG-456 and INC-2031 must be reviewed.",
    };
    const withDocuments = attachUnambiguousDocumentEvidence(workplaceGroups, [documentBridge]);
    expect(withDocuments).toHaveLength(2);
    expect(withDocuments.every((group) => group.length === 1)).toBe(true);

    const firstDocument = {
      ...evidence("document", "handbook#chunk-42", "handbook.pdf", "ENG-456 and DOC-2 must be reviewed."),
      taskSpan: "ENG-456 and DOC-2 must be reviewed.",
    };
    const transitiveDocument = {
      ...evidence("document", "handbook#chunk-43", "handbook.pdf", "DOC-2 must be reviewed."),
      taskSpan: "DOC-2 must be reviewed.",
    };
    const withoutTransitiveAttachment = attachUnambiguousDocumentEvidence(
      workplaceGroups,
      [firstDocument, transitiveDocument],
    );
    expect(withoutTransitiveAttachment.flat().map((item) => item.externalId)).toContain("handbook#chunk-42");
    expect(withoutTransitiveAttachment.flat().map((item) => item.externalId)).not.toContain("handbook#chunk-43");
  });

  it("leaves an ID-less entity record separate when its mapping is ambiguous", () => {
    const groups = clusterTaskEvidence([
      evidence("linear", "i1", "AuthShield incident INC-2031", "Customer access is blocked."),
      evidence("github", "p2", "AuthShield issue ENG-456", "Token lifetime work is open."),
      evidence("slack", "m2", "Customer escalation", "AuthShield needs attention."),
    ]);
    expect(groups).toHaveLength(3);
  });

  it("keeps generic work separate when identity is ambiguous", () => {
    expect(taskClusterKey(evidence("slack", "m3", "Review request", "Please review the change.")))
      .not.toBe(taskClusterKey(evidence("linear", "i3", "Review request", "Please review the change.")));

    const conflictingDateGroups = clusterTaskEvidence([
      {
        ...evidence("github", "issue-a", "Northwind incident INC-2031", "First commitment."),
        taskSpan: "I promised Northwind a written incident post-mortem by 10 August 2026.",
      },
      {
        ...evidence("slack", "message-b", "Northwind follow-up", "Changed commitment."),
        taskSpan: "I promised Northwind a written incident post-mortem by 10 August 2027.",
      },
    ]);
    expect(conflictingDateGroups).toHaveLength(2);

    const entityDateConflictGroups = clusterTaskEvidence([
      {
        ...evidence("github", "issue-date", "AuthShield incident INC-2031", "Tracked work."),
        taskSpan: "AuthShield incident report is due Aug 10, 2026.",
      },
      {
        ...evidence("slack", "message-date", "AuthShield follow-up", "Changed date."),
        taskSpan: "AuthShield incident report is due August 12, 2026.",
      },
    ]);
    expect(entityDateConflictGroups).toHaveLength(2);

    const relativeDateConflictGroups = clusterTaskEvidence([
      {
        ...evidence("github", "issue-relative", "AuthShield incident INC-2031", "Tracked work."),
        taskSpan: "AuthShield incident report is due Friday.",
        timestamp: "2026-08-02T12:00:00.000Z",
      },
      {
        ...evidence("slack", "message-relative", "AuthShield follow-up", "Later reminder."),
        taskSpan: "AuthShield incident report is due Friday.",
        timestamp: "2026-08-09T12:00:00.000Z",
      },
    ]);
    expect(relativeDateConflictGroups).toHaveLength(2);

    const unresolvedDateGroups = clusterTaskEvidence([
      {
        ...evidence("github", "issue-next", "AuthShield incident INC-2031", "Tracked work."),
        taskSpan: "AuthShield incident report is due Friday.",
        timestamp: "2026-08-02T12:00:00.000Z",
      },
      {
        ...evidence("slack", "message-next", "AuthShield follow-up", "Ambiguous reminder."),
        taskSpan: "AuthShield incident report is due next Friday.",
        timestamp: "2026-08-02T12:00:00.000Z",
      },
    ]);
    expect(unresolvedDateGroups).toHaveLength(2);

    const weekAndNumericDateGroups = clusterTaskEvidence([
      {
        ...evidence("github", "issue-week", "AuthShield incident INC-2031", "Tracked work."),
        taskSpan: "AuthShield incident report must ship this week on 10/08/2026.",
      },
      {
        ...evidence("slack", "message-week", "AuthShield follow-up", "Changed reminder."),
        taskSpan: "AuthShield incident report must ship next week on 12/08/2026.",
      },
    ]);
    expect(weekAndNumericDateGroups).toHaveLength(2);

    const hyphenDateGroups = clusterTaskEvidence([
      {
        ...evidence("github", "issue-hyphen", "AuthShield incident INC-2031", "Tracked work."),
        taskSpan: "AuthShield incident report must ship by 10-08-2026.",
      },
      {
        ...evidence("slack", "message-hyphen", "AuthShield follow-up", "Changed reminder."),
        taskSpan: "AuthShield incident report must ship by 10-08-2027.",
      },
    ]);
    expect(hyphenDateGroups).toHaveLength(2);

    const isoDateGroups = clusterTaskEvidence([
      {
        ...evidence("github", "issue-iso", "Incident INC-2031", "Tracked work."),
        taskSpan: "We promised Northwind a written incident post-mortem by 2026-08-10.",
      },
      {
        ...evidence("slack", "message-iso", "Northwind follow-up", "Original message."),
        taskSpan: "We promised Northwind a written incident post-mortem by 2026-08-10.",
      },
    ]);
    expect(isoDateGroups).toHaveLength(1);

    const isoDateTimeConflictGroups = clusterTaskEvidence([
      {
        ...evidence("github", "issue-datetime", "AuthShield incident INC-2031", "Tracked work."),
        taskSpan: "AuthShield incident report must ship by 2026-08-10T17:00Z.",
      },
      {
        ...evidence("slack", "message-datetime", "AuthShield follow-up", "Changed reminder."),
        taskSpan: "AuthShield incident report must ship by 2026-08-11T17:00Z.",
      },
    ]);
    expect(isoDateTimeConflictGroups).toHaveLength(2);

    const document = {
      ...evidence(
        "document",
        "doc-1#chunk-7",
        "helios-operations-handbook.pdf",
        "Engineering committed to ENG-456 before 7 August 2026.",
      ),
      taskSpan: "Engineering committed to ENG-456 before 7 August 2026.",
      timestamp: "2026-08-03T10:00:00.000Z",
      id: "document-source",
    };
    const workplace = {
      ...evidence("github", "issue-456", "ENG-456 token lifetime", "Engineering will finish ENG-456."),
      taskSpan: "Engineering will finish ENG-456 before 7 August 2026.",
      timestamp: null,
      id: "workplace-source",
    };
    expect(isHydraDocumentSource(
      { title: "helios-operations-handbook.pdf", app_kind: "file", app_provider: "github" },
      { source_type: "document", mime_type: "application/pdf" },
    )).toBe(true);
    expect(isHydraDocumentSource({
      title: "Customer escalation",
      app_kind: "email",
      app_provider: "gmail",
      content_type: "text/plain",
    })).toBe(false);
    expect(canOriginateQueueTask({
      ...evidence("github", "repo-file", "release-checklist.md", "Review ENG-456 by Friday."),
      taskSpan: "Review ENG-456 by Friday.",
    })).toBe(true);
    expect(canOriginateQueueTask(document)).toBe(false);
    const selectedPrimary = selectPrimaryQueueEvidence([document, workplace]);
    expect(selectedPrimary.provider).toBe("github");
    expect(queueSupportingEvidence([document, workplace], selectedPrimary).map((item) => item.id))
      .toEqual(["document-source"]);
    const span = extractActionableTaskSpan(
      "Reference material only. Engineering committed to ENG-456 before 7 August 2026. Appendix follows.",
    );
    expect(span).toContain("ENG-456");
    expect(span?.length).toBeLessThanOrEqual(360);
    for (const imperative of [
      "Review ENG-456 by Friday.",
      "Action: send the renewal today.",
      "Fix INC-2031.",
      "ENG-456 is due Friday.",
      "Must fix ENG-456 today.",
      "Need to send the renewal.",
      "We should review ENG-456.",
      "Question 3: Can you please fix ENG-456 by Friday?",
      "Please unsubscribe this customer and close the renewal task.",
      "Billing migration slipped to Friday.",
      "We will launch the beta on Friday.",
      "Alice will call Northwind tomorrow.",
      "I promised to refund the customer tomorrow.",
      "The access request remains open.",
      "The renewal is due Friday.",
      "The login bug is being fixed.",
      "The access request is being investigated.",
      "The proposal is being reviewed.",
    ]) {
      expect(extractActionableTaskSpan(imperative), imperative).not.toBeNull();
    }
    for (const nonLiveContext of [
      "Employment agreement. The work is confidential and proprietary and must not be shared outside the intended context.",
      "Next Step with Flywire: Homework. Question 3: provide the subject and body based on the above findings. I will report the example issue.",
      "Expert Academic Support. We bridge the gap between where you are and where you need to be. Affordable student pricing is available.",
      "Re: Next Steps & Pre-Contract Documentation - Successful Application. I will provide a right to work share code after a written offer, but not passport copies during onboarding.",
      "Important update: the Codelab submission deadline moved. Complete your MCQ assessment after the workshops.",
      "Written offer and onboarding steps are enclosed. Successful Application. We will confirm the onboarding process tomorrow.",
      "Complete the Codelab assessment after the workshops. We will finish tomorrow.",
      "Codelab update. Please complete this tomorrow.",
      "Codelab update. Alice will finish tomorrow.",
      "Codelab update. Support must complete today.",
      "Engineering will finish tomorrow. This is the Codelab submission deadline.",
      "Codelab update. Please complete this by Friday.",
      "Codelab update. Alice will finish by Friday.",
      "Codelab update. Please complete this by EOD.",
      "Codelab update. Could you please complete this by next week?",
      "Codelab update. Must complete this by Friday.",
      "Codelab update. Need to finish by EOD.",
      "Codelab update. Should complete this on Monday.",
      "Codelab update. Please complete this by end of day.",
      "Codelab update. Alice will finish by next month.",
      "Codelab update. Please complete this by August 10, 2026.",
      "Next Steps & Pre-Contract Documentation - Successful Application. Attachment: contract.pdf. Independent Contractor Agreement. Your notice is four weeks. You must continue to deliver and cooperate with the handover.",
      `Next Step with Flywire: Homework. Question 3: provide the subject and body. ${"Background material. ".repeat(40)}Let me know if that does not work; meanwhile I will report the issue with cents to the product dev team.`,
      "Your receipt from Anthropic, PBC #2452-6787-3896. Attachment: Invoice-GP8LA1AM-0028.pdf. Invoice number GP8LA1AM-0028. Date of issue June 24, 2026. Date due June 24, 2026. Bill to Example Ltd. Amount due GBP 18.20.",
      "Recipients must keep this information confidential.",
      "Students need to submit the assignment by Friday.",
      "We will help your business grow.",
      "We will stand by you every step of the way.",
      "The Agreement will update automatically by operation of law.",
      "The archive moved 10 files.",
    ]) {
      expect(extractActionableTaskSpan(nonLiveContext), nonLiveContext).toBeNull();
    }
    expect(extractActionableTaskSpan(
      "I promised Northwind a written incident post-mortem by 10 August. This email is confidential and intended only for the intended recipient.",
    )).toContain("Northwind");
    expect(extractActionableTaskSpan(
      "Please review ENG-456 by Friday. To unsubscribe from project notifications, click here.",
    )).toBe("Please review ENG-456 by Friday.");
    expect(extractActionableTaskSpan(
      "For internal use only. Engineering will ship ENG-456 by Friday.",
    )).toContain("ENG-456");
    expect(extractActionableTaskSpan(
      `Successful Application onboarding paperwork. ${"Background material. ".repeat(80)}Engineering will ship ENG-456 by Friday.`,
    )).toContain("ENG-456");
    expect(extractActionableTaskSpan(
      "Next Steps & Pre-Contract Documentation - Successful Application. Separately, Engineering must ship ENG-456 by Friday.",
    )).toContain("ENG-456");
    expect(extractActionableTaskSpan(
      "Your receipt from Anthropic. Invoice number GP8LA1AM-0028. Date due June 24, 2026. Bill to Example Ltd. Amount due GBP 18.20. On a separate note, please review the quarterly forecast tomorrow.",
    )).toContain("quarterly forecast");
    expect(extractActionableTaskSpan(
      "Please review the generic billing note\nEngineering will ship ENG-456 by Friday",
    )).toBe("Engineering will ship ENG-456 by Friday");
    expect(extractActionableTaskSpan(
      "Please confirm software renewal payment today.",
    )).toBe("Please confirm software renewal payment today.");
    expect(extractActionableTaskSpan(
      "Successful Application and written offer onboarding.\nPlease review the quarterly forecast tomorrow.",
    )).toBe("Please review the quarterly forecast tomorrow.");
    expect(extractActionableTaskSpan(
      "Important Codelab update.\nEngineering will finish the deployment tomorrow.",
    )).toBe("Engineering will finish the deployment tomorrow.");
    expect(extractActionableTaskSpan(
      "Engineering will finish tomorrow.\nSeparately, the Codelab assessment starts next week.",
    )).toBe("Engineering will finish tomorrow.");
    expect(extractActionableTaskSpan(
      "Engineering will finish tomorrow.\nThis week the Codelab assessment starts.",
    )).toBe("Engineering will finish tomorrow.");
    expect(extractActionableTaskSpan(
      "Engineering will finish tomorrow.\nThis is a separate, unrelated Codelab assessment starting next week.",
    )).toBe("Engineering will finish tomorrow.");
    expect(extractActionableTaskSpan(
      "Please provide your right to work share code tomorrow.\nThis follows your successful application and written offer.",
    )).toBeNull();
    expect(extractActionableTaskSpan(
      "ENG-456 onboarding audit. Successful Application. Please confirm written offer onboarding tomorrow.",
    )).toBe("Please confirm written offer onboarding tomorrow.");
    expect(canEmitQueueScore(0)).toBe(false);
    expect(canEmitQueueScore(-1)).toBe(false);
    expect(canEmitQueueScore(0.01)).toBe(true);
  });
});
