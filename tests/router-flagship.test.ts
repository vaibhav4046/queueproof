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

describe("clause stacking with auxiliary verbs", () => {
  it("routes a three-provider question joined by 'and is' to thinking", () => {
    // Observed routing to fast on a live run: only wh-words were matched after "and".
    const plan = planRetrieval(
      "Who escalated the AuthShield outage, what did engineering commit to, and is the fix already merged?",
    );
    expect(plan.mode).toBe("thinking");
  });

  it.each([
    "Who owns this and has it shipped?",
    "What is the deadline and did finance confirm it?",
    "Which issue is stale and should we close it?",
  ])("treats an auxiliary second clause as multi-step: %s", (question) => {
    expect(planRetrieval(question).mode).toBe("thinking");
  });

  it("still keeps a genuinely single-step lookup on fast", () => {
    expect(planRetrieval("Show me the Rover SDK docs ticket").mode).toBe("fast");
  });
});
