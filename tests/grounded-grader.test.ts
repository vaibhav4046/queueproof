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
        { id: "billing-migration", anyOf: ["billing migration"] },
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
      relevancePass: true,
      relevancePrecision: 1,
      irrelevantClaimRate: 0,
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

  it("fails a fully cited claim that carries no expected-fact signal", () => {
    const result = gradeGroundedAnswer({
      answer: "The billing migration deadline is 14 August and Slack puts it at 7 August. Medical billing fraud creates healthcare waste.",
      claims: [
        { text: "The billing migration deadline is 14 August.", citation_ids: ["linear-date"], providers: ["linear"] },
        {
          text: "Slack puts the billing migration deadline at 7 August.",
          citation_ids: ["slack-date"],
          providers: ["slack"],
        },
        { text: "Medical billing fraud creates healthcare waste.", citation_ids: ["gmail-noise"], providers: ["gmail"] },
      ],
      citations: [
        { id: "linear-date", provider: "linear", title: "Deadline", excerpt: "The billing migration deadline is 14 August." },
        {
          id: "slack-date",
          provider: "slack",
          title: "Finance",
          excerpt: "Slack puts the billing migration deadline at 7 August.",
        },
        { id: "gmail-noise", provider: "gmail", title: "Healthcare", excerpt: "Medical billing fraud creates healthcare waste." },
      ],
      providerCoverage: ["gmail", "linear", "slack"],
      requiredFacts: [
        { id: "subject", anyOf: ["billing migration"] },
        { id: "first", anyOf: ["7 August"] },
        { id: "second", anyOf: ["14 August"] },
      ],
      requiredProviders: ["linear", "slack"],
    });

    expect(result.citationPass).toBe(true);
    expect(result.relevancePass).toBe(false);
    expect(result.relevancePrecision).toBeCloseTo(2 / 3);
    expect(result.irrelevantClaimRate).toBeCloseTo(1 / 3);
    expect(result.irrelevantClaims).toEqual([
      expect.objectContaining({ index: 2, text: expect.stringMatching(/medical billing/i) }),
    ]);
    expect(result.supportedProviders).toEqual(["linear", "slack"]);
    expect(result.pass).toBe(false);
  });

  it("passes the same grounded answer after irrelevant evidence is removed", () => {
    const result = gradeGroundedAnswer({
      answer: "The billing migration deadline is 14 August and Slack puts it at 7 August.",
      claims: [
        { text: "The billing migration deadline is 14 August.", citation_ids: ["linear-date"], providers: ["linear"] },
        {
          text: "Slack puts the billing migration deadline at 7 August.",
          citation_ids: ["slack-date"],
          providers: ["slack"],
        },
      ],
      citations: [
        { id: "linear-date", provider: "linear", title: "Deadline", excerpt: "The billing migration deadline is 14 August." },
        {
          id: "slack-date",
          provider: "slack",
          title: "Finance",
          excerpt: "Slack puts the billing migration deadline at 7 August.",
        },
      ],
      providerCoverage: ["linear", "slack"],
      requiredFacts: [
        { id: "subject", anyOf: ["billing migration"] },
        { id: "first", anyOf: ["7 August"] },
        { id: "second", anyOf: ["14 August"] },
      ],
      requiredProviders: ["linear", "slack"],
    });

    expect(result.relevancePrecision).toBe(1);
    expect(result.irrelevantClaims).toEqual([]);
    expect(result.supportedProviders).toEqual(["linear", "slack"]);
    expect(result.pass).toBe(true);
  });

  it("treats a supported contradiction-only receipt as relevant provider proof", () => {
    const result = gradeGroundedAnswer({
      answer: "Linear puts the billing migration deadline at 14 August; Slack puts it at 7 August.",
      claims: [
        {
          text: "Linear puts the billing migration deadline at 14 August.",
          citation_ids: ["linear-date"],
          providers: ["linear"],
        },
      ],
      citations: [
        {
          id: "linear-date",
          provider: "linear",
          title: "Billing migration",
          excerpt: "Linear puts the billing migration deadline at 14 August.",
        },
        {
          id: "slack-date",
          provider: "slack",
          title: "Billing migration",
          excerpt: "Slack puts the billing migration deadline at 7 August.",
        },
      ],
      contradictions: [{
        summary: "Linear says 14 August; Slack says 7 August.",
        evidenceIds: ["linear-date", "slack-date"],
        providers: ["linear", "slack"],
      }],
      providerCoverage: ["linear", "slack"],
      requiredFacts: [
        { id: "subject", anyOf: ["billing migration"] },
        { id: "tracked-date", anyOf: ["14 August"] },
        { id: "slack-date", anyOf: ["7 August"] },
      ],
      requiredProviders: ["linear", "slack"],
      requiresContradiction: true,
    });

    expect(result.claimCount).toBe(1);
    expect(result.relevancePrecision).toBe(1);
    expect(result.citedSources).toEqual([
      expect.objectContaining({ id: "linear-date", relevant: true }),
      expect.objectContaining({ id: "slack-date", relevant: true }),
    ]);
    expect(result.supportedProviders).toEqual(["linear", "slack"]);
    expect(result.pass).toBe(true);
  });

  it("rejects a fabricated contradiction built from an unrelated date", () => {
    const result = gradeGroundedAnswer({
      answer: "Linear puts the billing migration deadline at 14 August. The Slack team picnic is 7 August.",
      claims: [
        {
          text: "Linear puts the billing migration deadline at 14 August.",
          citation_ids: ["linear-date"],
          providers: ["linear"],
        },
        { text: "The Slack team picnic is 7 August.", citation_ids: ["slack-picnic"], providers: ["slack"] },
      ],
      citations: [
        {
          id: "linear-date",
          provider: "linear",
          title: "Billing migration",
          excerpt: "Linear puts the billing migration deadline at 14 August.",
        },
        {
          id: "slack-picnic",
          provider: "slack",
          title: "Team social",
          excerpt: "The Slack team picnic is 7 August.",
        },
      ],
      contradictions: [{
        summary: "Linear says 14 August; Slack says 7 August.",
        evidenceIds: ["linear-date", "slack-picnic"],
        providers: ["linear", "slack"],
      }],
      providerCoverage: ["linear", "slack"],
      requiredFacts: [
        { id: "subject", anyOf: ["billing migration"] },
        { id: "first", anyOf: ["7 August"] },
        { id: "second", anyOf: ["14 August"] },
      ],
      requiredProviders: ["linear", "slack"],
      requiresContradiction: true,
    });

    expect(result.citationPass).toBe(true);
    expect(result.contradictionPass).toBe(false);
    expect(result.supportedContradictions).toEqual([]);
    expect(result.pass).toBe(false);
  });

  it("rejects a scalar claim whose topic appears only elsewhere in a mixed chunk", () => {
    const result = gradeGroundedAnswer({
      answer: "Linear puts the billing migration deadline at 14 August. The Slack team picnic is 7 August.",
      claims: [
        {
          text: "Linear puts the billing migration deadline at 14 August.",
          citation_ids: ["linear-date"],
          providers: ["linear"],
        },
        { text: "The Slack team picnic is 7 August.", citation_ids: ["slack-mixed"], providers: ["slack"] },
      ],
      citations: [
        {
          id: "linear-date",
          provider: "linear",
          title: "Billing migration",
          excerpt: "Linear puts the billing migration deadline at 14 August.",
        },
        {
          id: "slack-mixed",
          provider: "slack",
          title: "Billing migration status",
          excerpt: "Billing migration planned, and the Slack team picnic is 7 August.",
        },
      ],
      contradictions: [{
        summary: "Linear says 14 August; Slack says 7 August.",
        evidenceIds: ["linear-date", "slack-mixed"],
        providers: ["linear", "slack"],
      }],
      providerCoverage: ["linear", "slack"],
      requiredFacts: [
        { id: "subject", anyOf: ["billing migration"] },
        { id: "first", anyOf: ["7 August"] },
        { id: "second", anyOf: ["14 August"] },
      ],
      requiredProviders: ["linear", "slack"],
      requiresContradiction: true,
    });

    expect(result.citationPass).toBe(true);
    expect(result.relevancePrecision).toBeCloseTo(1 / 2);
    expect(result.supportedProviders).toEqual(["linear"]);
    expect(result.contradictionPass).toBe(false);
    expect(result.pass).toBe(false);
  });

  it("accepts an attributed conflict when both receipts mention both dates", () => {
    const result = gradeGroundedAnswer({
      answer: "Linear moved the billing migration from 7 August to 14 August; Slack says finance kept it at 7 August.",
      claims: [
        {
          text: "The billing migration deadline moved from 7 August to 14 August 2026.",
          citation_ids: ["linear-both-dates"],
          providers: ["linear"],
        },
        {
          text: "The Linear ticket says 14 August, but finance is staying at 7 August.",
          citation_ids: ["slack-both-dates"],
          providers: ["slack"],
        },
      ],
      citations: [
        {
          id: "linear-both-dates",
          provider: "linear",
          title: "Billing migration deadline moved to 14 August",
          excerpt: "The billing migration deadline moved from 7 August to 14 August 2026.",
        },
        {
          id: "slack-both-dates",
          provider: "slack",
          title: "Billing migration deadline",
          excerpt: "The Linear ticket says 14 August, but finance is staying at 7 August.",
        },
      ],
      contradictions: [{
        summary: "Linear says 14 August 2026; Slack says 7 August.",
        evidenceIds: ["linear-both-dates", "slack-both-dates"],
        providers: ["linear", "slack"],
      }],
      providerCoverage: ["linear", "slack"],
      requiredFacts: [
        { id: "subject", anyOf: ["billing migration"] },
        { id: "first", anyOf: ["7 August"] },
        { id: "second", anyOf: ["14 August"] },
      ],
      requiredProviders: ["linear", "slack"],
      requiresContradiction: true,
    });

    expect(result.supportedContradictions).toHaveLength(1);
    expect(result.contradictionPass).toBe(true);
    expect(result.pass).toBe(true);
  });

  it("rejects a generic status hit without the case topic", () => {
    const result = gradeGroundedAnswer({
      answer: "The AuthShield fix merged, but ENG-456 remains open. The documentation branch merged.",
      claims: [
        {
          text: "The AuthShield fix merged.",
          citation_ids: ["github-authshield"],
          providers: ["github"],
        },
        {
          text: "The AuthShield issue ENG-456 remains open.",
          citation_ids: ["linear-authshield"],
          providers: ["linear"],
        },
        {
          text: "The documentation branch merged.",
          citation_ids: ["gmail-docs"],
          providers: ["gmail"],
        },
      ],
      citations: [
        {
          id: "github-authshield",
          provider: "github",
          title: "AuthShield",
          excerpt: "The AuthShield fix merged.",
        },
        {
          id: "linear-authshield",
          provider: "linear",
          title: "AuthShield ENG-456",
          excerpt: "The AuthShield issue ENG-456 remains open.",
        },
        {
          id: "gmail-docs",
          provider: "gmail",
          title: "Documentation",
          excerpt: "The AuthShield fix merged. The documentation branch merged.",
        },
      ],
      providerCoverage: ["github", "linear", "gmail"],
      requiredFacts: [
        { id: "subject", anyOf: ["authshield"] },
        { id: "merged", anyOf: ["merged"] },
        { id: "open", anyOf: ["remains open", "still open"] },
      ],
      requiredProviders: ["github", "linear"],
    });

    expect(result.citationPass).toBe(true);
    expect(result.relevancePrecision).toBeCloseTo(2 / 3);
    expect(result.irrelevantClaims).toEqual([
      expect.objectContaining({ index: 2, text: "The documentation branch merged." }),
    ]);
    expect(result.supportedProviders).toEqual(["github", "linear"]);
    expect(result.pass).toBe(false);
  });

  it("rejects a one-token overlap with a compound required fact", () => {
    const result = gradeGroundedAnswer({
      answer: "Northwind escalated the AuthShield incident. Northwind ordered new chairs.",
      claims: [
        {
          text: "Northwind escalated the AuthShield incident.",
          citation_ids: ["slack-incident"],
          providers: ["slack"],
        },
        {
          text: "Northwind ordered new chairs.",
          citation_ids: ["gmail-chairs"],
          providers: ["gmail"],
        },
      ],
      citations: [
        {
          id: "slack-incident",
          provider: "slack",
          title: "AuthShield incident",
          excerpt: "Northwind escalated the AuthShield incident.",
        },
        {
          id: "gmail-chairs",
          provider: "gmail",
          title: "Office order",
          excerpt: "Northwind ordered new chairs.",
        },
      ],
      providerCoverage: ["gmail", "slack"],
      requiredFacts: [{
        id: "northwind-escalation",
        allOf: [["northwind"], ["escalated", "escalation"], ["authshield"]],
      }],
      requiredProviders: ["slack"],
    });

    expect(result.relevancePrecision).toBeCloseTo(1 / 2);
    expect(result.irrelevantClaims).toEqual([
      expect.objectContaining({ index: 1, text: "Northwind ordered new chairs." }),
    ]);
    expect(result.supportedProviders).toEqual(["slack"]);
    expect(result.pass).toBe(false);
  });

  it("requires a contradiction to cite topically aligned, disagreeing providers", () => {
    const base = {
      answer: "Slack puts the billing migration deadline at 7 August while Linear says 14 August.",
      claims: [
        {
          text: "Slack puts the billing migration deadline at 7 August.",
          citation_ids: ["slack-date"],
          providers: ["slack"],
        },
        {
          text: "Linear puts the billing migration deadline at 14 August.",
          citation_ids: ["linear-date"],
          providers: ["linear"],
        },
      ],
      citations: [
        {
          id: "slack-date",
          provider: "slack",
          title: "Billing migration",
          excerpt: "Slack puts the billing migration deadline at 7 August.",
        },
        {
          id: "linear-date",
          provider: "linear",
          title: "Billing migration",
          excerpt: "Linear puts the billing migration deadline at 14 August.",
        },
      ],
      providerCoverage: ["slack", "linear"],
      requiredFacts: [
        { id: "subject", anyOf: ["billing migration"] },
        { id: "first", anyOf: ["7 August"] },
        { id: "second", anyOf: ["14 August"] },
      ],
      requiredProviders: ["slack", "linear"],
      requiresContradiction: true,
    };

    const absent = gradeGroundedAnswer({ ...base, contradictions: [] });
    expect(absent.contradictionPass).toBe(false);
    expect(absent.pass).toBe(false);

    const supported = gradeGroundedAnswer({
      ...base,
      contradictions: [{
        summary: "Slack says 7 August; Linear says 14 August.",
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
  it("declares explicit facts, providers, and contradiction expectations for the frozen live corpus", () => {
    expect(liveCases.length).toBeGreaterThanOrEqual(6);
    for (const benchmark of liveCases) {
      expect(benchmark.expected.length, benchmark.id).toBeGreaterThan(0);
      expect(benchmark.requiredFacts.length, benchmark.id).toBeGreaterThan(0);
      expect(benchmark.requiredProviders.length, benchmark.id).toBeGreaterThan(0);
      expect(typeof benchmark.requiresContradiction, benchmark.id).toBe("boolean");
    }
  });
});
