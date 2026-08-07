import { describe, expect, it } from "vitest";
import { focusedEvidenceFollowUpQuery, trackerStateIdentifiers } from "../packages/retrieval/src";

describe("stale tracker join-key repair", () => {
  const question = "What did we ship most recently, and does the tracker still show that work as open?";
  const receipt =
    "The AuthShield authentication fix for the Northwind outage (INC-2031) was merged. " +
    "Linear issue ENG-456 is still showing as open even though the code is shipped. Someone should close it.";

  it("extracts only the identifier attached to the independently asserted open tracker state", () => {
    expect(trackerStateIdentifiers(question, [receipt])).toEqual(["ENG-456"]);
  });

  it("does not dilute the second-hop tracker query with a completed incident identifier", () => {
    const query = focusedEvidenceFollowUpQuery(question, [receipt]);
    expect(query?.split(" ")[0]).toBe("ENG-456");
    expect(query).not.toContain("INC-2031");
    expect(query).toContain("still open");
    expect(query).toContain("tracked state");
  });

  it("keeps ordinary multi-hop identifier expansion unchanged", () => {
    const query = focusedEvidenceFollowUpQuery(
      "What is BUG-123, who filed it, and which project is it against?",
      ["Slack says Priya Raman filed BUG-123 for AuthShield against Atlas Launch and references INC-2031."],
    );
    expect(query).toContain("BUG-123");
    expect(query).toContain("INC-2031");
  });
});
