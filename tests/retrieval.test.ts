import { describe, expect, it } from "vitest";
import { planRetrieval } from "../packages/retrieval/src";

describe("retrieval planner", () => {
  it("runs exact identifier lookup with parallel lexical fallback", () => {
    expect(planRetrieval("What happened to LIN-442?")).toMatchObject({
      category: "exact_identifier", mode: "fast", queryBy: "text", exactParallel: true,
    });
  });
  it.each([
    ["What changed since yesterday?", "temporal_reasoning"],
    ["Find conflicting decisions across Slack and Gmail", "conflict_analysis"],
    ["What if the dependency is resolved?", "counterfactual"],
    ["Summarise Linear and GitHub", "cross_source_fact"],
  ])("routes %s to grounded thinking", (query, category) => {
    expect(planRetrieval(query)).toMatchObject({ category, mode: "thinking", graphContext: true });
  });
  it("keeps a simple fact query fast", () => {
    expect(planRetrieval("Who owns the launch?")).toMatchObject({ category: "single_source_fact", mode: "fast" });
  });
});
