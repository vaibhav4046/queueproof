import { describe, expect, it } from "vitest";
import { clusterTaskEvidence, taskClusterKey } from "../lib/server/queue";

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
    const groups = clusterTaskEvidence([
      evidence("linear", "i1", "AuthShield incident INC-2031", "Customer access is blocked."),
      evidence("github", "p2", "AuthShield issue ENG-456", "Token lifetime work is open."),
    ]);
    expect(groups).toHaveLength(2);
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
  });
});
