import { describe, expect, it } from "vitest";
import fixtures from "../evals/fixtures/cases.json";
import { planRetrieval } from "../packages/retrieval/src";

describe("test-only evaluation fixtures", () => {
  it("contains at least thirty labelled cases", () => expect(fixtures.length).toBeGreaterThanOrEqual(30));
  it.each(fixtures)("$id routes consistently", (fixture) => {
    expect(planRetrieval(fixture.query).category).toBe(fixture.expectedCategory);
  });
});

