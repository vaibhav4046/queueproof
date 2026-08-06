import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  boundedDeliveryRepairProviders,
  coverageRepairProviderOrder,
  evidenceFollowUpTerms,
  focusedEvidenceFollowUpQuery,
  isUnanchoredRecencyDeliveryQuestion,
  planRetrieval,
  recordIdentifiers,
  retrievalIntentTerms,
  retrievalQueryVariants,
  shouldRunFastCoverageRepair,
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

  it("routes broad recent-delivery questions through at most three systems of record", () => {
    const broad = "What is the most recent thing we shipped?";
    const broadWithTracker = "What did we ship most recently, and does the tracker still show that work as open?";
    expect(isUnanchoredRecencyDeliveryQuestion(broad)).toBe(true);
    expect(isUnanchoredRecencyDeliveryQuestion(broadWithTracker)).toBe(true);
    expect(isUnanchoredRecencyDeliveryQuestion("What is the latest Northwind release?")).toBe(false);
    expect(isUnanchoredRecencyDeliveryQuestion("What shipped in GitHub most recently?")).toBe(false);
    expect(boundedDeliveryRepairProviders(broad, ["gmail", "slack", "linear", "github", "jira"])).toEqual([
      "github", "linear", "jira",
    ]);
    expect(boundedDeliveryRepairProviders(broad, ["gmail"])).toEqual([]);
  });

  it("adds delivery and tracker-state terms without introducing an entity", () => {
    expect(retrievalIntentTerms("What is the most recent thing we shipped?")).toEqual([
      "merged", "shipped", "released", "deployed",
    ]);
    expect(retrievalIntentTerms(
      "What did we ship most recently, and does the tracker still show that work as open?",
    )).toEqual(["merged", "shipped", "released", "deployed", "still open", "tracked state"]);
  });

  it("executes the bounded delivery lanes in Fast and suppresses the redundant global Thinking retry", () => {
    const askRoute = readFileSync(join(process.cwd(), "app/api/ask/route.ts"), "utf8");
    expect(askRoute).toContain("boundedDeliveryRepairProviders(");
    expect(askRoute).toContain("requestedSourceIds.length === 0 || payload.includeConnectors === true");
    expect(askRoute).toContain('runQueryBatch(retrievalQuery, ["hybrid"], "follow_up", "fast", deliveryRepairScopes)');
    expect(askRoute).toContain("decision.escalate && !deliveryRepairAttempted");
  });

  it("repairs a single-provider join before paying Thinking cost", () => {
    expect(shouldRunFastCoverageRepair({
      category: "exact_identifier",
      plannedMode: "fast",
      evidenceProviders: ["slack"],
      contradictionProviders: [],
    })).toBe(true);
    const staleWorkPlan = planRetrieval("Which open issue appears to be already resolved elsewhere?");
    expect(staleWorkPlan).toMatchObject({ category: "single_source_fact", mode: "thinking" });
    expect(shouldRunFastCoverageRepair({
      category: staleWorkPlan.category,
      plannedMode: staleWorkPlan.mode,
      evidenceProviders: ["github"],
      contradictionProviders: [["github"]],
    })).toBe(true);
    expect(shouldRunFastCoverageRepair({
      category: "cross_source_fact",
      plannedMode: "thinking",
      evidenceProviders: ["github", "linear"],
      contradictionProviders: [["github", "linear"]],
    })).toBe(false);
  });

  it("does not count a scoped document as a second connector receipt", () => {
    expect(shouldRunFastCoverageRepair({
      category: "exact_identifier",
      plannedMode: "thinking",
      evidenceProviders: ["document", "github"],
      contradictionProviders: [],
    })).toBe(true);
    expect(shouldRunFastCoverageRepair({
      category: "exact_identifier",
      plannedMode: "thinking",
      evidenceProviders: ["document", "github", "linear"],
      contradictionProviders: [],
    })).toBe(false);
    expect(shouldRunFastCoverageRepair({
      category: "exact_identifier",
      plannedMode: "thinking",
      evidenceProviders: ["document", "github", "linear"],
      contradictionProviders: [],
      namedProviders: ["github", "linear", "slack"],
    })).toBe(true);
  });

  it("targets a missing provider named by retained evidence", () => {
    expect(coverageRepairProviderOrder({
      question: "Which open issue appears to be already resolved elsewhere?",
      evidencePassages: ["The code shipped, but the tracked Linear record is ENG-456."],
      availableProviders: ["gmail", "github", "linear", "slack"],
      evidenceProviders: ["github"],
      category: "single_source_fact",
    })).toEqual(["linear"]);
  });

  it("orders exact-ID repair toward work trackers without encoding fixture entities", () => {
    expect(coverageRepairProviderOrder({
      question: "What is OPS-742, who filed it, and which project is it against?",
      evidencePassages: ["A chat receipt says Morgan filed OPS-742 against Beacon."],
      availableProviders: ["gmail", "github", "linear", "slack"],
      evidenceProviders: ["slack"],
      category: "exact_identifier",
    })).toEqual(["linear", "github", "gmail"]);
  });

  it("never repairs a provider already represented by valid evidence", () => {
    expect(coverageRepairProviderOrder({
      question: "Compare Linear and GitHub for OPS-742.",
      evidencePassages: ["Linear and GitHub both reference OPS-742."],
      availableProviders: ["gmail", "github", "linear", "slack"],
      evidenceProviders: ["linear", "github"],
      category: "exact_identifier",
    })).not.toEqual(expect.arrayContaining(["linear", "github"]));
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

  it("preserves the full namespaced identifier through routing and follow-up", () => {
    expect(recordIdentifiers("Compare DRAFT-OPS-14 with OPS-POL-14 and BUG-123.")).toEqual([
      "DRAFT-OPS-14", "OPS-POL-14", "BUG-123",
    ]);
    expect(planRetrieval("Is DRAFT-OPS-14 still binding?")).toMatchObject({
      category: "exact_identifier",
      exactParallel: true,
    });
    expect(focusedEvidenceFollowUpQuery(
      "Is DRAFT-OPS-14 still binding?",
      ["DRAFT-OPS-14 was replaced by ADR-037."],
    )?.split(" ").slice(0, 2)).toEqual(["DRAFT-OPS-14", "ADR-037"]);
  });
});
