import { describe, expect, it } from "vitest";
import { rankEvidenceForQuestion, synthesiseGroundedAnswer } from "../lib/server/synthesis";

const evidence = [
  {
    id: "linear-1",
    provider: "linear",
    title: "AuthShield authentication outage for Northwind",
    excerpt: "INC-2031: Northwind reported an authentication outage. Priya Raman filed this against Atlas Launch. Engineering committed to shipping the AuthShield fix before Friday 7 August 2026.",
  },
  {
    id: "slack-1",
    provider: "slack",
    title: "Northwind escalation",
    excerpt: "Northwind escalated the AuthShield authentication outage. Priya Raman filed BUG-123 against Atlas Launch.",
  },
  {
    id: "github-1",
    provider: "github",
    title: "AuthShield fix merged",
    excerpt: "The AuthShield authentication fix was merged. Linear issue ENG-456 is still showing as open even though the code is shipped.",
  },
  {
    id: "gmail-noise",
    provider: "gmail",
    title: "Unrelated newsletter",
    excerpt: "This newsletter describes browser testing and developer productivity.",
  },
];

describe("evidence-constrained synthesis", () => {
  it("answers the flagship question with cited, cross-provider source sentences", () => {
    const result = synthesiseGroundedAnswer(
      "Who escalated the AuthShield outage, what did engineering commit to, and is the fix already merged?",
      evidence,
    );

    expect(result.validation.status).toBe("grounded");
    expect(result.validation.providerCoverage).toEqual(expect.arrayContaining(["linear", "slack", "github"]));
    expect(result.answer).toContain("[");
    expect(result.answer).toMatch(/committed|shipping/i);
    expect(result.answer).toMatch(/merged/i);
    expect(result.claims.every((claim) => claim.evidenceIds.length > 0)).toBe(true);
  });

  it("ranks on-topic receipts above unrelated retrieved records", () => {
    const ranked = rankEvidenceForQuestion("Is the AuthShield fix merged?", evidence);
    expect(ranked[0].id).toBe("github-1");
    expect(ranked.findIndex((item) => item.id === "gmail-noise")).toBe(-1);
  });

  it("preserves a merged-versus-open execution-state contradiction", () => {
    const result = synthesiseGroundedAnswer("Is the AuthShield fix already merged?", evidence);
    expect(result.contradictions.some((item) => /still open/i.test(item.summary))).toBe(true);
  });

  it("does not promote an unrelated paragraph just because its document title is relevant", () => {
    const result = synthesiseGroundedAnswer(
      "Who is Priya Raman and what has she been working on?",
      [
        ...evidence,
        {
          id: "noisy-doc",
          provider: "gmail",
          title: "Priya Raman project notes",
          excerpt: "She opened up to her friend and they have known each other for ten years. This paragraph is unrelated to engineering work.",
        },
      ],
    );

    expect(result.answer).toMatch(/Priya Raman|Atlas Launch/i);
    expect(result.answer).not.toMatch(/opened up|ten years/i);
  });

  it("requires billing or migration context before citing a generic deadline sentence", () => {
    const result = synthesiseGroundedAnswer(
      "Which sources disagree about the billing migration deadline?",
      [
        {
          id: "billing-linear",
          provider: "linear",
          title: "Billing migration",
          excerpt: "The billing migration deadline moved from 7 August to 14 August 2026.",
        },
        {
          id: "generic-deadline",
          provider: "gmail",
          title: "Account notice",
          excerpt: "This is the final deadline to transfer or archive your personal data.",
        },
      ],
    );

    expect(result.answer).toContain("billing migration");
    expect(result.answer).not.toContain("personal data");
  });

  it("requires tracked and completed state for a stale-work question", () => {
    const result = synthesiseGroundedAnswer(
      "Which open issue appears to be already resolved elsewhere?",
      [
        evidence[2],
        {
          id: "resolved-newsletter",
          provider: "gmail",
          title: "Market update",
          excerpt: "Three external risks have mostly been resolved, making the case for better performance.",
        },
      ],
    );

    expect(result.answer).toMatch(/issue ENG-456|shipped/i);
    expect(result.answer).not.toContain("external risks");
  });

  it("does not confuse filed-against prose with an exact identifier", () => {
    const result = synthesiseGroundedAnswer(
      "What is BUG-123, who filed it, and which project is it against?",
      [
        evidence[1],
        {
          id: "lawsuit-newsletter",
          provider: "gmail",
          title: "Industry news",
          excerpt: "A company filed a lawsuit against a user over alleged misuse.",
        },
      ],
    );

    expect(result.answer).toContain("BUG-123");
    expect(result.answer).not.toContain("lawsuit");
  });

  it("extracts an exact-ID fact after markdown headings instead of dropping the long chunk", () => {
    const result = synthesiseGroundedAnswer(
      "What work does ENG-456 track and when is it due?",
      [{
        id: "handbook-eng-456",
        provider: "document",
        title: "helios-operations-handbook.pdf",
        excerpt: "### Objective AuthShield replaces long lived credentials with short lived tokens. ### Open work ENG-456 reduces the AuthShield operator token lifetime to fifteen minutes. The committed completion date is 30 June 2031. ### Dependencies The broker must be online.",
      }],
    );

    expect(result.answer).toContain("ENG-456");
    expect(result.answer).toMatch(/fifteen minutes|30 June 2031/i);
  });

  it("keeps a compact query-focused window for punctuation-free table evidence", () => {
    const result = synthesiseGroundedAnswer(
      "Who is the Ring 0 on call contact for the Bengaluru depot?",
      [{
        id: "handbook-oncall",
        provider: "document",
        title: "On call rotation table",
        excerpt: "| Ring | Depot | Contact | | Ring 0 | Bengaluru | Priya Raman | | Ring 1 | Osaka | Kenji Mori |",
      }],
    );

    expect(result.answer).toMatch(/Bengaluru.*Priya Raman/i);
  });

  it("extracts the programme code paired with an alias from a dense table", () => {
    const result = synthesiseGroundedAnswer(
      "Which internal programme code does the project alias Rover SDK refer to?",
      [{
        id: "handbook-aliases",
        provider: "document",
        title: "Project alias registry",
        excerpt: "| Alias | Code | Scope | | Atlas Launch | HR-P1 | Depot fleet | | AuthShield | HR-P2 | Identity | | Billing Migration | HR-P3 | Ledger | | Rover SDK | HR-P4 | Field autonomy toolkit |",
      }],
    );

    expect(result.answer).toMatch(/Rover SDK.*HR-P4/i);
  });

  it("prefers the explicit English requirement over a transliterated duplicate", () => {
    const result = synthesiseGroundedAnswer(
      "According to the handbook, what does ENG-456 require?",
      [{
        id: "handbook-eng-456-languages",
        provider: "document",
        title: "AuthShield commitment record",
        excerpt: "Hindi transliteration: ENG-456 ke tahat token ka jeevankaal pandrah minute hoga. English translation: ENG-456 requires the AuthShield operator token lifetime to be reduced to fifteen minutes by 30 June 2031.",
      }],
    );

    expect(result.answer).toMatch(/fifteen minutes/i);
  });
});
