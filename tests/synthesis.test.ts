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
    excerpt: "Northwind escalated the AuthShield authentication outage (INC-2031). Priya Raman filed BUG-123 against Atlas Launch.",
  },
  {
    id: "github-1",
    provider: "github",
    title: "AuthShield fix merged",
    excerpt: "The AuthShield authentication fix for INC-2031 was merged. Linear issue ENG-456 is still showing as open even though the code is shipped.",
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

    expect(result.answer).toMatch(/AuthShield/i);
    expect(result.answer).toMatch(/issue ENG-456|shipped/i);
    expect(result.answer).not.toContain("external risks");
  });

  it("joins a stale-state receipt to the independently tracked provider context", () => {
    const result = synthesiseGroundedAnswer(
      "Which open issue appears to be already resolved elsewhere?",
      [evidence[2], evidence[0]],
    );

    expect(result.validation.providerCoverage).toEqual(expect.arrayContaining(["github", "linear"]));
    expect(result.contradictions).toEqual([
      expect.objectContaining({
        providers: expect.arrayContaining(["github", "linear"]),
        evidenceIds: expect.arrayContaining(["github-1", "linear-1"]),
      }),
    ]);
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
    expect(result.answer).toMatch(/AuthShield.*Northwind|Northwind.*AuthShield/i);
    expect(result.answer).not.toContain("lawsuit");
  });

  it("uses shared incident entities to cite the tracker behind an exact chat identifier", () => {
    const result = synthesiseGroundedAnswer(
      "What is BUG-123, who filed it, and which project is it against?",
      [evidence[1], evidence[0]],
    );

    expect(result.validation.providerCoverage).toEqual(expect.arrayContaining(["slack", "linear"]));
    expect(result.answer).toContain("BUG-123");
    expect(result.answer).toMatch(/Priya Raman filed this against Atlas Launch/i);
  });

  it("keeps the no-Linear tracking statement beside the promise it qualifies", () => {
    const result = synthesiseGroundedAnswer(
      "Which promise to Northwind has no issue tracking it?",
      [{
        id: "slack-postmortem",
        provider: "slack",
        title: "Northwind post-mortem commitment",
        excerpt: "I promised Northwind a written incident post-mortem by 10 August. There is no Linear issue tracking that yet, someone please raise one.",
      }],
    );

    expect(result.answer).toMatch(/written incident post-mortem/i);
    expect(result.answer).toMatch(/no Linear issue/i);
  });

  it("keeps incident context beside the actor named later in the same receipt", () => {
    const result = synthesiseGroundedAnswer(
      "Who is Priya Raman and what has she been working on?",
      [{
        id: "slack-priya",
        provider: "slack",
        title: "Northwind escalation",
        excerpt: "Northwind have escalated the AuthShield authentication outage (INC-2031). Their whole team has been locked out since 29 July. Priya Raman is on it and filed BUG-123 against Atlas Launch.",
      }],
    );

    expect(result.answer).toMatch(/Priya Raman/i);
    expect(result.answer).toMatch(/Northwind.*AuthShield|AuthShield.*Northwind/i);
    expect(result.answer).toMatch(/Atlas Launch/i);
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

  it("keeps a short connector receipt intact for a strict exact-ID one-hop bridge", () => {
    const documentVolume = Array.from({ length: 20 }, (_, index) => ({
      id: `handbook-related-${index}`,
      provider: "document",
      title: "helios-operations-handbook.pdf",
      excerpt: `Reference ${index}: ENG-456 is an AuthShield operator token lifetime requirement recorded in the handbook.`,
    }));
    const result = synthesiseGroundedAnswer(
      "According to the Helios operations handbook, what does ENG-456 require, and do Slack, Linear, or GitHub show related AuthShield work?",
      [
        {
          id: "handbook-eng-456",
          provider: "document",
          title: "helios-operations-handbook.pdf",
          excerpt: "ENG-456 reduces the AuthShield operator token lifetime to fifteen minutes. The committed completion date is 30 June 2031.",
        },
        ...documentVolume,
        {
          id: "github-eng-456",
          provider: "github",
          title: "AuthShield fix merged in PR-8871 but ENG-456 still open",
          excerpt: "The AuthShield authentication fix for the Northwind outage (INC-2031) was merged. Linear issue ENG-456 is still showing as open even though the code is shipped.",
        },
        {
          id: "linear-inc-2031",
          provider: "linear",
          title: "AuthShield authentication outage for Northwind",
          excerpt: "INC-2031: Northwind reported an authentication outage. Priya Raman filed this against Atlas Launch. Engineering committed to shipping the AuthShield fix before Friday 7 August 2026.",
        },
      ],
    );

    expect(result.validation.providerCoverage).toEqual(
      expect.arrayContaining(["document", "github", "linear"]),
    );
    expect(result.claims).toEqual(expect.arrayContaining([
      expect.objectContaining({
        providers: ["linear"],
        evidenceIds: ["linear-inc-2031"],
      }),
    ]));
    expect(result.answer).toMatch(/operator token lifetime.*fifteen minutes/i);
    expect(result.answer).toMatch(/INC-2031.*AuthShield|AuthShield.*INC-2031/i);
  });

  it("does not promote an unrelated short receipt merely for provider diversity", () => {
    const result = synthesiseGroundedAnswer(
      "According to the handbook, what does ENG-456 require, and does Slack show related AuthShield work?",
      [
        {
          id: "handbook-eng-456",
          provider: "document",
          title: "helios-operations-handbook.pdf",
          excerpt: "ENG-456 reduces the AuthShield operator token lifetime to fifteen minutes.",
        },
        {
          id: "slack-no-join-key",
          provider: "slack",
          title: "Credential training workshop",
          excerpt: "Northwind asked about a credential training session. The workshop is unrelated to any tracked incident or engineering delivery.",
        },
      ],
    );

    expect(result.validation.providerCoverage).toEqual(["document"]);
    expect(result.answer).not.toMatch(/workshop|training session/i);
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

  it("keeps complete policy-state wording across independently cited receipts", () => {
    const result = synthesiseGroundedAnswer(
      "What did OPS-POL-14 originally permit for Rover SDK field firmware flashing?",
      [
        {
          id: "policy-original",
          provider: "document",
          title: "operations-handbook.pdf",
          excerpt: "OPS-POL-14 Rover SDK field firmware flashing. At a depot, a single Tier 2 engineer may flash Rover SDK field firmware without a second approver, provided the rover is on a maintenance stand with the drive system isolated.",
        },
        {
          id: "policy-replacement",
          provider: "document",
          title: "operations-handbook.pdf",
          excerpt: "ADR-037, dated 9 September 2031, supersedes OPS-POL-14. From this date every Rover SDK field firmware flash requires two approvers, and one must be a Safety Case Owner. The single engineer permission in OPS-POL-14 is withdrawn and must not be relied on.",
        },
      ],
    );

    expect(result.answer).toMatch(/single Tier 2 engineer/i);
    expect(result.answer).toMatch(/without a second approver/i);
    expect(result.answer).toMatch(/maintenance stand/i);
    expect(result.answer).toMatch(/permission in OPS-POL-14 is withdrawn/i);
    expect(result.answer).not.toMatch(/permission in OPS-POL-14 is withdraw\s*\[/i);
    expect(new Set(result.claims.flatMap((claim) => claim.evidenceIds))).toEqual(
      new Set(["policy-original", "policy-replacement"]),
    );
  });

  it("does not let one verbose draft receipt crowd out its binding replacement", () => {
    const result = synthesiseGroundedAnswer(
      "Does DRAFT-OPS-14 permit single engineer firmware flashing today?",
      [
        {
          id: "draft-record",
          provider: "document",
          title: "operations-handbook.pdf",
          excerpt: "DRAFT-OPS-14 was never ratified and carries no operational authority. It proposed that any engineer could flash rover firmware from a maintenance stand. It is routinely confused with OPS-POL-14, which was superseded by ADR-037. Neither the draft nor the superseded policy permits single engineer flashing today.",
        },
        {
          id: "binding-record",
          provider: "document",
          title: "operations-handbook.pdf",
          excerpt: "ADR-037 is the binding rule for rover firmware flashing. Every field firmware flash requires two approvers, including a Safety Case Owner.",
        },
        {
          id: "historical-record",
          provider: "document",
          title: "operations-handbook.pdf",
          excerpt: "OPS-POL-14 previously allowed a single Tier 2 engineer to flash firmware without a second approver while the rover was on a maintenance stand.",
        },
      ],
    );

    expect(result.answer).toMatch(/never ratified/i);
    expect(result.answer).toMatch(/no operational authority/i);
    expect(result.answer).toMatch(/ADR-037/i);
    expect(result.answer).toMatch(/two approvers/i);
    expect(result.claims.some((claim) => claim.evidenceIds.includes("binding-record"))).toBe(true);
  });

  it("follows a retrieved supersession edge to a current decision with different wording", () => {
    const result = synthesiseGroundedAnswer(
      "Does DRAFT-FIELD-82 permit solo operator calibration today?",
      [
        {
          id: "draft-authority",
          provider: "document",
          title: "field-operations.pdf",
          excerpt: "DRAFT-FIELD-82 was never ratified and carries no operational authority. The related POLICY-FIELD-8 was superseded by DEC-204.",
        },
        {
          id: "current-authority",
          provider: "document",
          title: "field-operations.pdf",
          excerpt: "DEC-204 is the current controlling decision. It requires dual authorization for every calibration change.",
        },
        {
          id: "keyword-distractor",
          provider: "document",
          title: "training-draft.pdf",
          excerpt: "A training exercise asks whether a draft could permit solo operator calibration today. It is not an operational record.",
        },
      ],
    );

    expect(result.answer).toMatch(/never ratified/i);
    expect(result.answer).toMatch(/no operational authority/i);
    expect(result.answer).toMatch(/DEC-204/i);
    expect(result.answer).toMatch(/dual authorization/i);
    expect(result.answer).not.toMatch(/training exercise/i);
    expect(result.claims.some((claim) => claim.evidenceIds.includes("current-authority"))).toBe(true);
  });

  it("keeps historical permission and later withdrawal as separate cited authority states", () => {
    const result = synthesiseGroundedAnswer(
      "What did POLICY-FIELD-8 originally permit for field calibration?",
      [
        {
          id: "historical-permission",
          provider: "document",
          title: "field-operations.pdf",
          excerpt: "POLICY-FIELD-8 originally permitted one operator to calibrate a unit while it was isolated on a service stand.",
        },
        {
          id: "superseding-decision",
          provider: "document",
          title: "field-operations.pdf",
          excerpt: "DEC-204 supersedes POLICY-FIELD-8. The one-operator permission is withdrawn and must not be relied on.",
        },
        {
          id: "unrelated-policy",
          provider: "document",
          title: "office-policy.pdf",
          excerpt: "The current office policy permits one operator to reserve a calibration room.",
        },
      ],
    );

    expect(result.answer).toMatch(/one operator/i);
    expect(result.answer).toMatch(/service stand/i);
    expect(result.answer).toMatch(/permission is withdrawn/i);
    expect(result.answer).toMatch(/must not be relied on/i);
    expect(result.answer).not.toMatch(/reserve a calibration room/i);
    expect(new Set(result.claims.flatMap((claim) => claim.evidenceIds))).toEqual(
      new Set(["historical-permission", "superseding-decision"]),
    );
  });

  it("returns the newest shipped item first for a most-recently question and excludes unrelated recent records", () => {
    const result = synthesiseGroundedAnswer(
      "What did we ship most recently?",
      [
        {
          id: "old-ship",
          provider: "slack",
          title: "Telemetry pipeline deployment",
          excerpt: "The telemetry pipeline is ready to ship. Engineering prepared it in January.",
          timestamp: "2026-01-20T08:00:00Z",
        },
        {
          id: "new-ship",
          provider: "github",
          title: "Northwind hotfix release",
          excerpt: "The authentication hotfix for Northwind is ready to ship this week.",
          timestamp: "2026-07-28T09:00:00Z",
        },
        {
          id: "newsletter",
          provider: "gmail",
          title: "Weekly browser tips",
          excerpt: "This newsletter describes browser testing and developer productivity.",
          timestamp: "2026-08-04T10:00:00Z",
        },
      ],
    );

    expect(result.validation.status).toBe("grounded");
    // The newest shipped item must rank first in the evidence list.
    expect(result.evidence[0].id).toBe("new-ship");
    // The answer's opening sentence must be the newest ship receipt.
    expect(result.answer).toMatch(/authentication hotfix for Northwind/);
    // The unrelated newsletter (newest overall but base relevance 0) must not appear.
    expect(result.answer).not.toMatch(/newsletter/i);
    expect(result.answer).not.toMatch(/browser testing/i);
  });

  it("ranks the newest relevant evidence first for a latest-question via rankEvidenceForQuestion", () => {
    const evidence = [
      {
        id: "linear-old",
        provider: "linear",
        title: "Billing reconciliation",
        excerpt: "The billing reconciliation fix is ready to ship to production.",
        timestamp: "2026-03-01T10:00:00Z",
      },
      {
        id: "github-new",
        provider: "github",
        title: "Reporting dashboard release",
        excerpt: "The customer-facing reporting dashboard is ready to ship after QA sign-off.",
        timestamp: "2026-07-30T14:00:00Z",
      },
      {
        id: "noise",
        provider: "gmail",
        title: "Team lunch invitation",
        excerpt: "Join us for the August team lunch next Thursday.",
        timestamp: "2026-08-04T09:00:00Z",
      },
    ];
    const ranked = rankEvidenceForQuestion("What did we ship latest?", evidence);
    expect(ranked[0].id).toBe("github-new");
    expect(ranked.every((item) => item.id !== "noise")).toBe(true);
  });

  // Regression: production returned HTTP 200 with validation.status "grounded" for
  // this question, stitching four unrelated Gmail newsletters that each merely used
  // the word "ship". The excerpts below are synthetic but reproduce the exact shape
  // of the fragments that were wrongly promoted.
  it("abstains instead of stitching newsletters that only mention the word ship", () => {
    const result = synthesiseGroundedAnswer(
      "What did we ship most recently and what proves it?",
      [
        {
          id: "news-1",
          provider: "gmail",
          title: "The staff+ engineer digest",
          excerpt:
            "This first-person take explores how the staff+ engineer role changes once you are no longer the person who writes most of the code.",
          timestamp: "2026-08-01T08:00:00Z",
        },
        {
          id: "news-2",
          provider: "gmail",
          title: "Trade and freight briefing",
          excerpt:
            "Withholding tax treatment for chartering an Indian ship remains unchanged for the current assessment year.",
          timestamp: "2026-08-02T08:00:00Z",
        },
        {
          id: "news-3",
          provider: "gmail",
          title: "Engineering productivity roundup",
          excerpt:
            "Moreover, there are still developers who do not ship code that compiles, and reviewers absorb the cost.",
          timestamp: "2026-08-03T08:00:00Z",
        },
        {
          id: "news-4",
          provider: "gmail",
          title: "Agent techniques roundup",
          excerpt:
            "A practical guide to the techniques teams use to ship production-ready agents without a dedicated platform team.",
          timestamp: "2026-08-04T08:00:00Z",
        },
        // These two survived the first fix: a bare past participle in ordinary
        // prose looked like a delivery assertion.
        {
          id: "news-5",
          provider: "gmail",
          title: "India logistics letter",
          excerpt:
            "Instead, the container is likely trans-shipped from a nearby port in another country, as three-quarters of long-distance shipments are.",
          timestamp: "2026-08-04T09:00:00Z",
        },
        {
          id: "news-6",
          provider: "gmail",
          title: "Weekend hack announcement",
          excerpt: "Whatever you ship across the weekend is released as open source.",
          timestamp: "2026-08-04T10:00:00Z",
        },
      ],
    );
    expect(result.validation.status).toBe("abstained");
    expect(result.answer).toMatch(/^Insufficient evidence\./i);
    expect(result.answer).not.toMatch(/Indian ship/i);
    expect(result.answer).not.toMatch(/staff\+/i);
    expect(result.answer).not.toMatch(/Moreover/i);
    expect(result.answer).not.toMatch(/trans-shipped/i);
    expect(result.answer).not.toMatch(/open source/i);
  });

  it("still answers the same delivery question when a real ship receipt is present", () => {
    const result = synthesiseGroundedAnswer(
      "What did we ship most recently and what proves it?",
      [
        {
          id: "news-3",
          provider: "gmail",
          title: "Engineering productivity roundup",
          excerpt:
            "Moreover, there are still developers who do not ship code that compiles, and reviewers absorb the cost.",
          timestamp: "2026-08-03T08:00:00Z",
        },
        {
          id: "release",
          provider: "github",
          title: "Billing reconciliation release",
          excerpt: "The billing reconciliation fix was deployed to production on 2 August 2026.",
          timestamp: "2026-08-02T09:00:00Z",
        },
      ],
    );
    expect(result.validation.status).not.toBe("abstained");
    expect(result.answer).toMatch(/billing reconciliation fix was deployed/i);
    expect(result.answer).not.toMatch(/Moreover/i);
  });

  it("bridges a recent delivery to the independently tracked open state", () => {
    const result = synthesiseGroundedAnswer(
      "What did we ship most recently, and does the tracker still show that work as open?",
      [
        {
          id: "github-release",
          provider: "github",
          title: "Authentication fix merged but tracker still open",
          excerpt:
            "The authentication fix for the Northwind outage (INC-2031) was merged. "
            + "Linear issue ENG-456 is still showing as open even though the code is shipped.",
          timestamp: "2026-08-02T17:39:45Z",
        },
        {
          id: "linear-incident",
          provider: "linear",
          title: "Authentication outage for Northwind",
          excerpt:
            "INC-2031: Northwind reported an authentication outage. Priya Raman filed this against Atlas Launch.",
          timestamp: "2026-08-02T01:03:55Z",
        },
        {
          id: "gmail-newsletter",
          provider: "gmail",
          title: "Latest product launches",
          excerpt: "A newsletter about companies that launched products this week.",
          timestamp: "2026-08-04T17:12:32Z",
        },
      ],
    );

    expect(result.validation.status).not.toBe("abstained");
    expect(result.answer).toMatch(/INC-2031/i);
    expect(result.answer).toMatch(/ENG-456/i);
    expect(result.evidence.map((item) => item.id)).toEqual(expect.arrayContaining([
      "github-release", "linear-incident",
    ]));
    expect(result.contradictions).toEqual(expect.arrayContaining([
      expect.objectContaining({ providers: ["github", "linear"] }),
    ]));
    expect(result.answer).not.toMatch(/newsletter/i);
  });

  // Production defect: the multi-hop BUG-123 question returned three claims that
  // were overlapping windows of one Slack message, so the same sentence appeared
  // three times in one answer. The relaxed fallback that fills claim slots when
  // the provider-diversity quota starves the main pass was skipping every
  // duplicate check.
  it("never repeats the same sentence across claims when one source dominates", () => {
    const result = synthesiseGroundedAnswer(
      "Who filed BUG-123, which project are they working on, and what did they say about the fix in Slack?",
      [
        {
          id: "slack-1",
          provider: "slack",
          title: "#incident-northwind",
          excerpt:
            "Northwind have escalated the AuthShield authentication outage (INC-2031). "
            + "Their whole team has been locked out since 29 July. "
            + "Priya Raman is on it and filed BUG-123 against Atlas Launch.",
          timestamp: "2026-07-30T09:00:00Z",
        },
      ],
    );
    const sentences = result.answer
      .replace(/\s*\[\d+\]/g, "")
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim())
      .filter((sentence) => sentence.length >= 25);
    expect(sentences.length).toBeGreaterThan(0);
    expect(new Set(sentences).size).toBe(sentences.length);
  });

  // Production defect: an ingested markdown status document had bullets opening
  // with a code span and with lowercase words, so none of them registered as a
  // sentence boundary. The whole list became one window, hit the 420-character
  // cap, and the answer ended on the fragment "The lo".
  // Production defect: an ingested markdown status document had bullets opening
  // with a code span and with lowercase words, so none of them registered as a
  // sentence boundary. The whole list collapsed into one window and the answer
  // surfaced a run-on that glued unrelated bullets together.
  it("treats every markdown bullet as its own claim boundary", () => {
    const bullets = [
      "`/api/health/live` reports the exact commit and branch for the running deployment",
      "real stale-state retrieval now identifies ENG-456 as merged and shipped while the ticket is still open",
      "the longest investigation in the frozen benchmark completed in nine seconds",
    ];
    const excerpt = ["Release evidence", ...bullets.map((line) => `- ${line}`)].join("\n");
    const result = synthesiseGroundedAnswer(
      "What does the release evidence say about ENG-456?",
      [{ id: "doc-1", provider: "document", title: "Release evidence", excerpt, timestamp: "2026-08-04T12:00:00Z" }],
    );
    expect(result.validation.status).not.toBe("abstained");
    // A claim carrying the distinctive opening of two different bullets is a
    // run-on: the list was never split, so unrelated facts read as one statement.
    const fingerprints = ["/api/health/live", "real stale-state retrieval", "the longest investigation"];
    for (const claim of result.claims) {
      const spanned = fingerprints.filter((fingerprint) => claim.text.includes(fingerprint));
      expect(spanned.length).toBeLessThan(2);
    }
  });

  // Production defect, reproduced from the live flagship probe on 2026-08-06:
  // "What is blocking the Atlas launch?" returned four citations that opened on a
  // recruiter email about Atlas Copco -- a different company that happens to share
  // the token "atlas" and to use the word "launch" in boilerplate. Two of the four
  // citations were the same job-advert fragment and two more restated each other,
  // so the answer never said what the blocker was.
  const atlasBlockerCorpus = [
    {
      id: "gmail-jobs-1",
      provider: "gmail",
      title: "New jobs for you: Project Engineer",
      excerpt:
        "Deeside £30,000 - £45,000 a year Easily apply Delivering projects from concept "
        + "through to launch in line with Atlas Copco's lean-agile development process.",
      timestamp: "2026-08-05T06:00:00Z",
    },
    {
      id: "gmail-jobs-2",
      provider: "gmail",
      title: "New jobs for you: Delivery Lead",
      excerpt:
        "Manchester Easily apply Delivering projects from concept through to launch in "
        + "line with Atlas Copco's lean-agile development process. 1 day ago",
      timestamp: "2026-08-05T06:10:00Z",
    },
    {
      id: "linear-atlas",
      provider: "linear",
      title: "ENG-802 Atlas Launch readiness",
      excerpt:
        "Atlas Launch is blocked on the AuthShield migration: ENG-802 cannot start until "
        + "the Northwind tenant is migrated off the legacy token service.",
      timestamp: "2026-08-04T09:00:00Z",
    },
    {
      id: "slack-atlas",
      provider: "slack",
      title: "#atlas-launch",
      excerpt: "Blocked on the AuthShield migration: Atlas Launch cannot start.",
      timestamp: "2026-08-04T10:00:00Z",
    },
  ];

  it("does not answer a blocker question from prose that merely shares the entity token", () => {
    const result = synthesiseGroundedAnswer("What is blocking the Atlas launch?", atlasBlockerCorpus);

    const cited = new Set(result.claims.flatMap((claim) => claim.evidenceIds));
    expect(cited.has("gmail-jobs-1")).toBe(false);
    expect(cited.has("gmail-jobs-2")).toBe(false);
    expect(result.answer).not.toMatch(/copco/i);
  });

  // Production defect query_a2b8eb3e-783e-455a-af16-449048fd5750:
  // Quick mode retrieved independent lexical facets from four unrelated records
  // and labelled their combination grounded, even though none stated Atlas
  // Launch's general-availability date.
  const atlasGaNoise = [
    {
      id: "linear-authshield",
      provider: "linear",
      title: "AuthShield authentication outage for Northwind",
      excerpt:
        "INC-2031: enterprise customer Northwind reported an authentication outage on 29 July 2026. "
        + "Priya Raman filed this against Atlas Launch. Engineering committed to shipping the AuthShield "
        + "fix before Friday 7 August 2026.",
    },
    {
      id: "gmail-snowflake",
      provider: "gmail",
      title: "Snowflake Cross-Cloud Iceberg Replication",
      excerpt:
        "Iceberg table replication is in public preview, not general availability. "
        + "Treat it as pre-GA and expect changes before general availability.",
    },
    {
      id: "slack-authshield",
      provider: "slack",
      title: "Northwind escalation",
      excerpt:
        "Northwind escalated INC-2031. Priya Raman filed BUG-123 against Atlas Launch.",
    },
    {
      id: "gmail-anthropic",
      provider: "gmail",
      title: "Introducing Claude Fable 5 and Claude Mythos 5",
      excerpt:
        "Anthropic held back a public launch until it built stronger safety controls. "
        + "Fable 5 has a launch date of June 9, 2026.",
    },
  ];

  it("abstains when committed GA-date facets come from unrelated records", () => {
    const result = synthesiseGroundedAnswer(
      "What was the committed general availability date for Atlas Launch?",
      atlasGaNoise,
    );

    expect(result.validation.status).toBe("abstained");
    expect(result.answer).toBe("Insufficient evidence. QueueProof will not invent an answer.");
    expect(result.claims).toEqual([]);
  });

  it("answers a committed GA-date lookup from one subject-bound receipt", () => {
    const result = synthesiseGroundedAnswer(
      "What was the committed general availability date for Atlas Launch?",
      [
        ...atlasGaNoise,
        {
          id: "document-atlas-dossier",
          provider: "document",
          title: "Helios Robotics engineering handbook",
          excerpt:
            "Delivery. Atlas Launch reached general availability on 14 March 2031, four weeks later "
            + "than the original plan.",
        },
      ],
    );

    expect(result.validation.status).toBe("grounded");
    expect(result.answer).toMatch(/Atlas Launch reached general availability on 14 March 2031/i);
    expect(new Set(result.claims.flatMap((claim) => claim.evidenceIds))).toEqual(
      new Set(["document-atlas-dossier"]),
    );
  });

  it("states the blocker rather than restating the same receipt twice", () => {
    const result = synthesiseGroundedAnswer("What is blocking the Atlas launch?", atlasBlockerCorpus);

    expect(result.validation.status).not.toBe("abstained");
    expect(result.answer).toMatch(/authshield migration/i);
    // The Slack line reorders the Linear sentence without adding a single new
    // content word, so it is the same claim and must not consume a second slot.
    expect(result.claims.length).toBe(1);
  });

  it("does not answer a blocker question from an impediment about a different subject", () => {
    // Stating an obstruction is not the same as stating this question's
    // obstruction. Production answered "What is blocking the Atlas launch?" from
    // this commit body: "blocked by" satisfied the impediment gate, and the
    // anchor match was carried entirely by the generic noun "launch" in "launch
    // failure" while "Atlas" appeared nowhere in the evidence.
    const unrelatedImpediment = {
      id: "github-hook-runner",
      provider: "github",
      title: "Preserve compound receipt context and harden stale-state retrieval",
      excerpt:
        "The local hook runner itself is blocked by a Windows/WSL E_ACCESSDENIED launch "
        + "failure; every underlying gate above was run directly and passed before these.",
      timestamp: "2026-08-05T12:00:00Z",
    };

    const result = synthesiseGroundedAnswer(
      "What is blocking the Atlas launch?",
      [unrelatedImpediment],
    );

    expect(result.validation.status).toBe("abstained");
    expect(result.answer).toBe("Insufficient evidence. QueueProof will not invent an answer.");
  });

  it("still answers the blocker question when the real receipt is present alongside it", () => {
    const unrelatedImpediment = {
      id: "github-hook-runner",
      provider: "github",
      title: "Preserve compound receipt context and harden stale-state retrieval",
      excerpt:
        "The local hook runner itself is blocked by a Windows/WSL E_ACCESSDENIED launch "
        + "failure; every underlying gate above was run directly and passed before these.",
      timestamp: "2026-08-05T12:00:00Z",
    };

    const result = synthesiseGroundedAnswer(
      "What is blocking the Atlas launch?",
      [...atlasBlockerCorpus, unrelatedImpediment],
    );

    expect(result.validation.status).not.toBe("abstained");
    expect(result.answer).toMatch(/authshield migration/i);
    const cited = new Set(result.claims.flatMap((claim) => claim.evidenceIds));
    expect(cited.has("github-hook-runner")).toBe(false);
  });

  it("abstains on a blocker question when no record states an impediment", () => {
    const result = synthesiseGroundedAnswer(
      "What is blocking the Atlas launch?",
      atlasBlockerCorpus.slice(0, 2),
    );

    expect(result.validation.status).toBe("abstained");
    expect(result.answer).toBe("Insufficient evidence. QueueProof will not invent an answer.");
  });
});
