import { describe, expect, it } from "vitest";
import { taskClusterKey } from "../lib/server/queue";

const evidence = (provider: string, externalId: string, title: string, excerpt: string) => ({
  provider, externalId, title, excerpt,
});

describe("conservative cross-source task clustering", () => {
  it("joins an exact issue identity across providers", () => {
    expect(taskClusterKey(evidence("slack", "m1", "Escalation", "Engineering is fixing BUG-123 today.")))
      .toBe(taskClusterKey(evidence("linear", "i1", "BUG-123", "Issue remains in progress.")));
  });

  it("joins a distinctive product identity across providers", () => {
    expect(taskClusterKey(evidence("slack", "m2", "Customer escalation", "AuthShield is blocking sign-in.")))
      .toBe(taskClusterKey(evidence("github", "p2", "Patch merged", "AuthShield remediation landed.")));
  });

  it("keeps generic work separate when identity is ambiguous", () => {
    expect(taskClusterKey(evidence("slack", "m3", "Review request", "Please review the change.")))
      .not.toBe(taskClusterKey(evidence("linear", "i3", "Review request", "Please review the change.")));
  });
});
