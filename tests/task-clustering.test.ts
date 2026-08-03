import { describe, expect, it } from "vitest";
import {
  attachUnambiguousDocumentEvidence,
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
  });
});
