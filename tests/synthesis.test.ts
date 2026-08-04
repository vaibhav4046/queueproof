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

  it("marks a multi-part answer partial when retrieved evidence covers only one requested facet", () => {
    const result = synthesiseGroundedAnswer(
      "Who escalated the AuthShield outage, what did engineering commit to, and is the fix already merged?",
      [evidence[1]],
    );

    expect(result.validation.status).toBe("partial");
    expect(result.missingInformation).toEqual(expect.arrayContaining([
      expect.stringMatching(/commitment/i),
      expect.stringMatching(/completion state/i),
    ]));
    expect(result.answer).toMatch(/escalat/i);
  });

  it("uses the explicit insufficient-evidence language when no claim is supportable", () => {
    const result = synthesiseGroundedAnswer(
      "What did engineering commit to for AuthShield?",
      [evidence[3]],
    );

    expect(result.validation.status).toBe("abstained");
    expect(result.answer).toMatch(/^Insufficient evidence\./i);
  });

  it("ranks on-topic receipts above unrelated retrieved records", () => {
    const ranked = rankEvidenceForQuestion("Is the AuthShield fix merged?", evidence);
    expect(ranked[0].id).toBe("github-1");
    expect(ranked.findIndex((item) => item.id === "gmail-noise")).toBe(-1);
  });

  it("preserves a merged-versus-open execution-state contradiction", () => {
    const result = synthesiseGroundedAnswer("Is the AuthShield fix already merged?", evidence);
    expect(result.contradictions).toEqual([
      expect.objectContaining({
        summary: expect.stringMatching(/github receipt.+ENG-456 remains open/i),
        providers: ["github"],
        evidenceIds: ["github-1"],
      }),
    ]);
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

  it("detects a deadline conflict when one source omits the shared year", () => {
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
          id: "billing-slack",
          provider: "slack",
          title: "Billing migration decision",
          excerpt: "Finance confirmed the billing migration is staying at 7 August.",
        },
      ],
    );

    expect(result.contradictions).toEqual([
      expect.objectContaining({ providers: expect.arrayContaining(["linear", "slack"]) }),
    ]);
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

  it("includes the fix release and release date for a defect question", () => {
    const result = synthesiseGroundedAnswer(
      "What defect does BUG-123 record and in which release was it fixed?",
      [{
        id: "handbook-bug-123",
        provider: "document",
        title: "helios-operations-handbook.pdf",
        excerpt: "Change Log. ## Defect record BUG-123. Symptom BUG-123 records odometry drift after cold boot on Rover SDK 4.2.0. Fix fixed in Rover SDK 4.2.1, released on 21 May 2031.",
      }],
    );

    expect(result.answer).toMatch(/Rover SDK 4\.2\.1/i);
    expect(result.answer).toMatch(/21 May 2031/i);
  });

  it("extracts the superseding decision and its two-approver replacement rule", () => {
    const result = synthesiseGroundedAnswer(
      "Is the single approver firmware flashing rule in OPS-POL-14 still in force?",
      [{
        id: "handbook-adr-037",
        provider: "document",
        title: "helios-operations-handbook.pdf",
        excerpt: "ADR-037, dated 9 September 2031, supersedes OPS-POL-14 and requires two approvers, one of whom must be a Safety Case Owner. The single engineer permission in OPS-POL-14 is withdrawn and must not be relied on.",
      }],
    );

    expect(result.answer).toMatch(/two approvers/i);
    expect(result.answer).toMatch(/Safety Case Owner/i);
    expect(result.answer).toMatch(/withdrawn|must not be relied on/i);
  });

  it("keeps the no-longer-in-force state for an originally-permitted policy", () => {
    const result = synthesiseGroundedAnswer(
      "What did OPS-POL-14 originally permit for Rover SDK field firmware flashing?",
      [{
        id: "handbook-ops-pol-14",
        provider: "document",
        title: "helios-operations-handbook.pdf",
        excerpt: "Rule a single Tier 2 engineer could flash Rover SDK field firmware without a second approver while the rover was on a maintenance stand. This permission is no longer in force.",
      }],
    );

    expect(result.answer).toMatch(/single Tier 2 engineer/i);
    expect(result.answer).toMatch(/without a second approver/i);
    expect(result.answer).toMatch(/no longer in force/i);
  });

  it("surfaces the desk sentence when the question asks which desk someone runs", () => {
    const result = synthesiseGroundedAnswer(
      "What is Priya Ramanathan's role at Helios Robotics and which desk does she run?",
      [
        {
          id: "handbook-people",
          provider: "document",
          title: "helios-operations-handbook.pdf",
          excerpt: "Customer operations. Priya Ramanathan, Customer Escalation Manager, employee HR-5871, running the Billing Migration escalation desk.",
        },
        {
          id: "handbook-people-2",
          provider: "document",
          title: "helios-operations-handbook.pdf",
          excerpt: "A ticket that names only Priya is routed by subject: identity to HR-2214, billing to HR-5871.",
        },
      ],
    );

    expect(result.answer).toMatch(/Customer Escalation Manager/i);
    expect(result.answer).toMatch(/Billing Migration escalation desk/i);
  });

  it("surfaces never-ratified and no-authority wording for a draft question", () => {
    const result = synthesiseGroundedAnswer(
      "Does DRAFT-OPS-14 permit single engineer firmware flashing today?",
      [
        {
          id: "handbook-draft",
          provider: "document",
          title: "helios-operations-handbook.pdf",
          excerpt: "No. DRAFT-OPS-14 was never ratified and carries no operational authority. The binding rule is ADR-037, which requires two approvers.",
        },
        {
          id: "handbook-draft-2",
          provider: "document",
          title: "helios-operations-handbook.pdf",
          excerpt: "DRAFT-ESC-9 A proposal to let the escalation desk issue credits up to a fixed limit without ledger access.",
        },
      ],
    );

    expect(result.answer).toMatch(/never ratified/i);
    expect(result.answer).toMatch(/no operational authority/i);
    expect(result.answer).toMatch(/ADR-037/i);
  });

  it("extracts the customer impact window for an incident question", () => {
    const result = synthesiseGroundedAnswer(
      "What happened in INC-2031 and how long did customer impact last?",
      [{
        id: "handbook-inc-2031",
        provider: "document",
        title: "helios-operations-handbook.pdf",
        excerpt: "Incident report INC-2031. Summary INC-2031 was a Billing Migration double charge event on 8 April 2031, with 41 minutes of customer impact.",
      }],
    );

    expect(result.answer).toMatch(/41 minutes/i);
    expect(result.answer).toMatch(/customer impact/i);
  });

  it("keeps the event summary when impact-window sentences repeat across chunks", () => {
    const result = synthesiseGroundedAnswer(
      "What happened in INC-2031 and how long did customer impact last?",
      [
        {
          id: "handbook-inc-a",
          provider: "document",
          title: "helios-operations-handbook.pdf",
          excerpt: "## Incident report INC-2031. Summary INC-2031 was a Billing Migration double charge event on 8 April 2031. Customer impact lasted 41 minutes, from the first duplicate write until the run was halted.",
        },
        {
          id: "handbook-inc-b",
          provider: "document",
          title: "helios-operations-handbook.pdf",
          excerpt: "Impact is the customer visible window, not the time the incident channel stayed open. The summary covers incidents with customer visible impact. Confirms the impact has stopped.",
        },
        {
          id: "handbook-inc-c",
          provider: "document",
          title: "helios-operations-handbook.pdf",
          excerpt: "Impact window is measured from the first duplicate write. Do not offer a credit before the impact window is measured. Estimated credits that later shrink cost more trust.",
        },
      ],
    );

    // The impact-window sentences repeat across chunks; they must collapse into
    // one claim so the event summary keeps a slot in the four-claim answer, and
    // definitional "customer visible window" prose must not crowd it out.
    expect(result.answer).toMatch(/Billing Migration/i);
    expect(result.answer).toMatch(/double charge/i);
    expect(result.answer).toMatch(/8 April 2031/i);
    expect(result.answer).toMatch(/41 minutes/i);
    expect(result.answer).not.toMatch(/customer visible window, not the time/i);
    expect(result.answer).not.toMatch(/summary covers incidents/i);
  });

  it("extracts the escalation desk a named employee runs", () => {
    const result = synthesiseGroundedAnswer(
      "What is Priya Ramanathan's role at Helios Robotics and which desk does she run?",
      [{
        id: "handbook-people",
        provider: "document",
        title: "helios-operations-handbook.pdf",
        excerpt: "Customer operations. Priya Ramanathan, Customer Escalation Manager, employee HR-5871, running the Billing Migration escalation desk.",
      }],
    );

    expect(result.answer).toMatch(/Customer Escalation Manager/i);
    expect(result.answer).toMatch(/Billing Migration/i);
    expect(result.answer).toMatch(/escalation desk/i);
  });

  it("extracts the binding rule and two-approver requirement for a draft question", () => {
    const result = synthesiseGroundedAnswer(
      "Does DRAFT-OPS-14 permit single engineer firmware flashing today?",
      [{
        id: "handbook-draft",
        provider: "document",
        title: "helios-operations-handbook.pdf",
        excerpt: "No. DRAFT-OPS-14 was never ratified and carries no operational authority. The binding rule is ADR-037, which requires two approvers.",
      }],
    );

    expect(result.answer).toMatch(/never ratified/i);
    expect(result.answer).toMatch(/ADR-037/i);
    expect(result.answer).toMatch(/two approvers/i);
  });
});
