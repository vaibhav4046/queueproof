import { describe, expect, it } from "vitest";
import { evidenceFollowUpTerms, planRetrieval, retrievalQueryVariants } from "../packages/retrieval/src";

describe("retrieval planner", () => {
  it("runs exact identifier lookup with parallel lexical fallback", () => {
    const plan = planRetrieval("What happened to LIN-442?");
    expect(plan).toMatchObject({
      category: "exact_identifier", mode: "fast", queryBy: "text", exactParallel: true,
    });
    expect(retrievalQueryVariants(plan)).toEqual(["text", "hybrid"]);
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
    const plan = planRetrieval("Who owns the launch?");
    expect(plan).toMatchObject({ category: "single_source_fact", mode: "fast" });
    expect(retrievalQueryVariants(plan)).toEqual(["hybrid"]);
  });

  it("promotes absence and stale-open comparisons to thinking", () => {
    expect(planRetrieval("Which promise has no issue tracking it?").mode).toBe("thinking");
    expect(planRetrieval("Which open issue appears to be already resolved elsewhere?").mode).toBe("thinking");
  });
});

describe("evidence-derived follow-up terms", () => {
  it("extracts new record IDs and named entities without fixture-specific expansion", () => {
    expect(evidenceFollowUpTerms(
      "Who is Priya Raman and what is she working on?",
      [
        "Priya Raman filed BUG-123 against Atlas Launch.",
        "The AuthShield incident affected Northwind and references INC-2031.",
      ],
    )).toEqual(expect.arrayContaining(["BUG-123", "INC-2031", "Atlas Launch", "AuthShield", "Northwind"]));
  });

  it("does not repeat entities already present in the question", () => {
    const terms = evidenceFollowUpTerms("What is BUG-123 for Northwind?", [
      "BUG-123 tracks AuthShield remediation for Northwind and Atlas Launch.",
    ]);
    expect(terms).not.toContain("BUG-123");
    expect(terms).not.toContain("Northwind");
    expect(terms).toEqual(expect.arrayContaining(["AuthShield", "Atlas Launch"]));
  });
});
