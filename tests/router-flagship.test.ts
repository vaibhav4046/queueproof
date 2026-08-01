import { planRetrieval } from "../packages/retrieval/src/index";
import { describe, expect, it } from "vitest";
describe("flagship demo question", () => {
  it("routes the BUG-123 multi-provider question to thinking", () => {
    const plan = planRetrieval("Who filed BUG-123, which project are they working on, and what did they say about the fix in Slack?");
    expect(plan.mode).toBe("thinking");
    expect(plan.exactParallel).toBe(true);
    expect(plan.category).toBe("exact_identifier");
  });
  it("keeps a bare identifier lookup on fast", () => {
    const plan = planRetrieval("Show me BUG-123");
    expect(plan.mode).toBe("fast");
    expect(plan.exactParallel).toBe(true);
  });
});
