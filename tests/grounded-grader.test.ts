import { describe, expect, it } from "vitest";
import liveCases from "../evals/fixtures/live-cases.json";
import {
  gradeGroundedAnswer,
  matchRequiredFact,
  normaliseGradeText,
  summarisePdfCanaries,
} from "../evals/lib/grounded-grader.mjs";

const citations = [
  {
    id: "slack-1",
    provider: "slack",
    title: "Northwind escalation",
    excerpt: "Northwind escalated the AuthShield outage.",
  },
  {
    id: "linear-1",
    provider: "linear",
    title: "Billing Migration",
    excerpt: "The Billing Migration deadline is 14 August 2026.",
  },
];

describe("grounded benchmark grader", () => {
  it("normalises punctuation and markdown without weakening phrase matching", () => {
    expect(normaliseGradeText("**ENG-456** — fifteen minutes.")).toBe("eng 456 fifteen minutes");
    expect(matchRequiredFact("The Duty Operations Lead.", {
      id: "authority",
      anyOf: ["Duty Operations Lead"],
    }).matched).toBe(true);
  });

  it("passes only when facts, providers, and cited claim support are complete", () => {
    const result = gradeGroundedAnswer({
      answer: "Northwind escalated the AuthShield outage. The Billing Migration deadline is 14 August 2026.",
      claims: [
        { text: "Northwind escalated the AuthShield outage.", citation_ids: ["slack-1"], providers: ["slack"] },
        { text: "The Billing Migration deadline is 14 August 2026.", citation_ids: ["linear-1"], providers: ["linear"] },
      ],
      citations,
      providerCoverage: ["linear", "slack"],
      requiredFacts: [
        { id: "escalation", allOf: [["northwind"], ["authshield"], ["escalated", "escalation"]] },
        { id: "deadline", anyOf: ["14 August"] },
      ],
      requiredProviders: ["slack", "linear"],
    });

    expect(result).toMatchObject({
      pass: true,
      factPass: true,
      providerPass: true,
      citationPass: true,
      citationPrecision: 1,
      citationCompleteness: 1,
      unsupportedClaimRate: 0,
    });
  });

  it("fails a case with a missing required fact", () => {
    const result = gradeGroundedAnswer({
      answer: "A written incident post-mortem was promised by 10 August.",
      claims: [{
        text: "A written incident post-mortem was promised by 10 August.",
        citation_ids: ["slack-promise"],
        providers: ["slack"],
      }],
      citations: [{
        id: "slack-promise", provider: "slack", title: "Promise",
        excerpt: "A written incident post-mortem was promised by 10 August.",
      }],
      providerCoverage: ["slack"],
      requiredFacts: [
        { id: "promise", anyOf: ["post-mortem"] },
        { id: "not-tracked", anyOf: ["not tracked in Linear", "no Linear issue"] },
      ],
      requiredProviders: ["slack"],
    });

    expect(result.pass).toBe(false);
    expect(result.missingFacts.map((fact: { id: string }) => fact.id)).toEqual(["not-tracked"]);
  });

  it("does not accept a provider reported by the receipt without a supporting citation", () => {
    const result = gradeGroundedAnswer({
      answer: "Northwind escalated the AuthShield outage.",
      claims: [{ text: "Northwind escalated the AuthShield outage.", citation_ids: ["slack-1"], providers: ["slack"] }],
      citations,
      providerCoverage: ["linear", "slack"],
      requiredFacts: [{ id: "escalation", anyOf: ["northwind"] }],
      requiredProviders: ["linear", "slack"],
    });

    expect(result.providerPass).toBe(false);
    expect(result.missingProviders).toEqual(["linear"]);
    expect(result.reportedWithoutSupportingCitation).toContain("linear");
  });

  it("rejects missing citation IDs and citations whose excerpt does not support the claim", () => {
    const missing = gradeGroundedAnswer({
      answer: "The AuthShield fix merged.",
      claims: [{ text: "The AuthShield fix merged.", citation_ids: ["missing"], providers: ["github"] }],
      citations: [],
      requiredFacts: [{ id: "merged", anyOf: ["merged"] }],
      requiredProviders: ["github"],
    });
    expect(missing.invalidCitationIds).toEqual(["missing"]);
    expect(missing.citationPass).toBe(false);

    const unsupported = gradeGroundedAnswer({
      answer: "The AuthShield fix merged.",
      claims: [{ text: "The AuthShield fix merged.", citation_ids: ["github-1"], providers: ["github"] }],
      citations: [{ id: "github-1", provider: "github", title: "Unrelated", excerpt: "A documentation typo was fixed." }],
      requiredFacts: [{ id: "merged", anyOf: ["merged"] }],
      requiredProviders: ["github"],
    });
    expect(unsupported.unsupportedClaims).toHaveLength(1);
    expect(unsupported.citationPrecision).toBe(0);
    expect(unsupported.pass).toBe(false);
  });

  it("requires a contradiction to cite two distinct providers when requested", () => {
    const base = {
      answer: "Slack says 7 August while Linear says 14 August.",
      claims: [
        { text: "Slack says 7 August.", citation_ids: ["slack-date"], providers: ["slack"] },
        { text: "Linear says 14 August.", citation_ids: ["linear-date"], providers: ["linear"] },
      ],
      citations: [
        { id: "slack-date", provider: "slack", title: "Slack deadline", excerpt: "Slack says 7 August." },
        { id: "linear-date", provider: "linear", title: "Linear deadline", excerpt: "Linear says 14 August." },
      ],
      providerCoverage: ["slack", "linear"],
      requiredFacts: [{ id: "first", anyOf: ["7 August"] }, { id: "second", anyOf: ["14 August"] }],
      requiredProviders: ["slack", "linear"],
      requiresContradiction: true,
    };

    const absent = gradeGroundedAnswer({ ...base, contradictions: [] });
    expect(absent.contradictionPass).toBe(false);
    expect(absent.pass).toBe(false);

    const supported = gradeGroundedAnswer({
      ...base,
      contradictions: [{
        summary: "Slack and Linear contain different dates.",
        evidenceIds: ["slack-date", "linear-date"],
        providers: ["slack", "linear"],
      }],
    });
    expect(supported.contradictionPass).toBe(true);
    expect(supported.pass).toBe(true);
  });

  it("uses the exact beginning, middle, and end PDF canary kinds", () => {
    expect(summarisePdfCanaries([
      { kind: "beginning_load_bearing", pass: true },
      { kind: "middle_load_bearing", pass: true },
      { kind: "end_load_bearing", pass: true },
    ])).toEqual({ beginning: true, middle: true, end: true });
    expect(summarisePdfCanaries([
      { kind: "beginning_load_bearing", pass: true },
      { kind: "middle_load_bearing", pass: true },
      { kind: "ending_load_bearing", pass: true },
    ])).toEqual({ beginning: true, middle: true, end: false });
  });
});

describe("frozen live benchmark cases", () => {
  it("declares explicit facts, providers, and contradiction expectations for all six cases", () => {
    expect(liveCases).toHaveLength(6);
    for (const benchmark of liveCases) {
      expect(benchmark.expected.length, benchmark.id).toBeGreaterThan(0);
      expect(benchmark.requiredFacts.length, benchmark.id).toBeGreaterThan(0);
      expect(benchmark.requiredProviders.length, benchmark.id).toBeGreaterThan(0);
      expect(typeof benchmark.requiresContradiction, benchmark.id).toBe("boolean");
    }
  });
});
