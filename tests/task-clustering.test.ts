import { describe, expect, it } from "vitest";
import {
  attachUnambiguousDocumentEvidence,
  canOriginateQueueTask,
  clusterTaskEvidence,
  extractActionableTaskSpan,
  isHydraDocumentSource,
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
    };
    const workplace = {
      ...evidence("github", "issue-456", "ENG-456 token lifetime", "Engineering will finish ENG-456."),
      taskSpan: "Engineering will finish ENG-456 before 7 August 2026.",
      timestamp: null,
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
    expect(selectPrimaryQueueEvidence([document, workplace]).provider).toBe("github");
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
    ]) {
      expect(extractActionableTaskSpan(imperative), imperative).not.toBeNull();
    }
  });
});
