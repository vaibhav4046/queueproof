import { describe, expect, it } from "vitest";
import {
  evidenceFollowUpTerms,
  focusedEvidenceFollowUpQuery,
  planRetrieval,
  retrievalIntentTerms,
  retrievalQueryVariants,
} from "../packages/retrieval/src";

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

  it("adds only state-language retrieval terms for an abstract stale-work question", () => {
    expect(retrievalIntentTerms("Which open issue appears to be already resolved elsewhere?")).toEqual([
      "merged", "shipped", "still open", "tracked state",
    ]);
    expect(retrievalIntentTerms("Show me ENG-456")).toEqual([]);
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

  it("leads a stale-work second hop with the exact join key discovered in evidence", () => {
    const query = focusedEvidenceFollowUpQuery(
      "Which open issue appears to be already resolved elsewhere?",
      ["AuthShield shipped in GitHub. The tracked Linear record is ENG-456."],
    );
    expect(query).toBe("ENG-456 AuthShield merged shipped still open tracked state");
    expect(query).not.toContain("Which open issue");
  });

  it("retains an identifier from the question while adding cross-source entities", () => {
    const query = focusedEvidenceFollowUpQuery(
      "What is BUG-123, who filed it, and which project is it against?",
      ["Slack says Priya Raman filed BUG-123 for the AuthShield incident against Atlas Launch at Northwind."],
    );
    expect(query?.split(" ").slice(0, 1)).toEqual(["BUG-123"]);
    expect(query).toContain("Priya Raman");
    expect(query).toContain("Atlas Launch");
    expect(query).toContain("AuthShield");
    expect(query).toContain("Northwind");
  });

  it("returns null when the first hop proves no usable join key", () => {
    expect(focusedEvidenceFollowUpQuery("Summarise it", ["the and this"])).toBeNull();
  });
});
