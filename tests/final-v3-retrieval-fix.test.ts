import { describe, expect, it } from "vitest";
import { synthesiseGroundedAnswer } from "../lib/server/synthesis";

describe("final v3 retrieval relevance regressions", () => {
  it("keeps an unrelated incident out of a missing-tracker promise answer", () => {
    const result = synthesiseGroundedAnswer(
      "Which promise to Northwind has no issue tracking it?",
      [
        {
          id: "slack-promise",
          provider: "slack",
          title: "Northwind post-mortem promise",
          excerpt: "I promised Northwind a written incident post-mortem by 10 August. There is no Linear issue tracking that yet, someone please raise one.",
        },
        {
          id: "github-promise",
          provider: "github",
          title: "Post-mortem doc for INC-2031 Northwind outage",
          excerpt: "Vaibhav promised Northwind a written incident post-mortem by 10 August 2026. Tracking it here since there is no Linear issue for it. Owner unassigned.",
        },
        {
          id: "linear-noise",
          provider: "linear",
          title: "AuthShield authentication outage for Northwind",
          excerpt: "INC-2031: enterprise customer Northwind reported an authentication outage on 29 July 2026. Priya Raman filed this against Atlas Launch. Engineering committed to shipping the AuthShield fix before Friday 7 August 2026.",
        },
      ],
    );
    expect(result.claims.map((claim) => claim.providers[0])).not.toContain("linear");
    expect(result.claims.map((claim) => claim.evidenceIds[0])).not.toContain("linear-noise");
    expect(result.answer).toMatch(/post-mortem/i);
    expect(result.answer).toMatch(/no Linear issue/i);
  });

  it("uses the tracker receipt, not a related incident, for an open-vs-complete contradiction", () => {
    const result = synthesiseGroundedAnswer(
      "Which open issue appears to be already resolved elsewhere?",
      [
        {
          id: "github-complete",
          provider: "github",
          title: "AuthShield fix merged in PR-8871 but ENG-456 still open",
          excerpt: "The AuthShield authentication fix for the Northwind outage (INC-2031) was merged. Linear issue ENG-456 is still showing as open even though the code is shipped. Someone should close it or explain why it is still tracked.",
        },
        {
          id: "linear-open",
          provider: "linear",
          title: "ENG-456 AuthShield tracker",
          excerpt: "Linear issue ENG-456 remains open for the AuthShield work linked to INC-2031 and Northwind.",
        },
        {
          id: "linear-noise",
          provider: "linear",
          title: "AuthShield authentication outage for Northwind",
          excerpt: "INC-2031: enterprise customer Northwind reported an authentication outage. Priya Raman filed this against Atlas Launch. Engineering committed to shipping the AuthShield fix.",
        },
      ],
    );
    const conflict = result.contradictions.find((item) => item.providers.includes("github") && item.providers.includes("linear"));
    expect(conflict).toBeTruthy();
    expect(conflict?.evidenceIds).toContain("linear-open");
    expect(conflict?.evidenceIds).not.toContain("linear-noise");
    expect(conflict?.summary).toMatch(/github reports the code complete while linear reports ENG-456 remains open/i);
  });
});
