import { describe, expect, it } from "vitest";
import { matchesSignal } from "../lib/server/queue";

/**
 * Regression tests for negation blindness in the ranking signals.
 *
 * Observed on production: a Linear ticket reading "Low priority documentation refresh
 * for the Rover SDK. No customer impact and no deadline." scored +9 for customer or
 * revenue consequence, because a plain keyword test saw the word "customer". The
 * deterministic explanation then stated a reason the source explicitly denies.
 */
const CUSTOMER = /\b(customer|client|enterprise|renewal|revenue|contract|churn)\b/i;
const URGENT = /\b(today|urgent|asap|immediately|blocking|deadline|overdue)\b/i;

describe("negation-aware signal matching", () => {
  it("counts a plain positive mention", () => {
    expect(matchesSignal("Enterprise customer Northwind escalated the outage", CUSTOMER)).toBe(true);
  });

  it.each([
    "No customer impact and no deadline.",
    "There is not a customer waiting on this.",
    "Shipped without customer involvement.",
    "This has zero revenue consequence.",
  ])("does not count a negated mention: %s", (text) => {
    expect(matchesSignal(text, CUSTOMER)).toBe(false);
  });

  it("counts the positive when a document both negates and asserts", () => {
    // One unnegated occurrence is enough — the signal is present somewhere.
    expect(
      matchesSignal("No customer impact on staging. The customer Northwind is blocked in production.", CUSTOMER),
    ).toBe(true);
  });

  it("applies to urgency as well", () => {
    expect(matchesSignal("There is no deadline for this work.", URGENT)).toBe(false);
    expect(matchesSignal("The deadline is Friday.", URGENT)).toBe(true);
  });

  it("reproduces the exact production ticket that regressed", () => {
    const ticket = "Rover SDK docs refresh Low priority documentation refresh for the Rover SDK. No customer impact and no deadline.";
    expect(matchesSignal(ticket, CUSTOMER)).toBe(false);
    expect(matchesSignal(ticket, URGENT)).toBe(false);
  });

  it("does not treat a distant negation as governing", () => {
    // The negation must be near the keyword, not anywhere in the text.
    expect(
      matchesSignal("No blockers were found during triage. A separate enterprise contract expires Friday.", CUSTOMER),
    ).toBe(true);
  });
});
