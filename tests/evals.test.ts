import { describe, expect, it } from "vitest";
import cases from "../evals/fixtures/cases.json";
import { EVAL_CATEGORIES, EVAL_PROVIDERS, computeMetrics, toCsv } from "../evals/lib/metrics.mjs";

describe("evaluation fixture corpus", () => {
  it("loads at least thirty ground truth cases", () => {
    expect(cases.length).toBeGreaterThanOrEqual(30);
  });

  it("gives every case a unique id", () => {
    const ids = cases.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("represents every required category", () => {
    const present = new Set(cases.map((item) => item.category));
    for (const category of EVAL_CATEGORIES) {
      expect(present, `category "${category}" is missing from the corpus`).toContain(category);
    }
  });

  it("declares at least one known provider per case", () => {
    for (const item of cases) {
      expect(item.requiredProviders.length, `${item.id} has no required provider`).toBeGreaterThanOrEqual(1);
      for (const provider of item.requiredProviders) {
        expect(EVAL_PROVIDERS).toContain(provider);
      }
    }
  });

  it("labels every case with an expected router mode", () => {
    for (const item of cases) {
      expect(["fast", "thinking"], `${item.id} has no usable expected.mode`).toContain(item.expected.mode);
    }
  });

  it("keeps question and the legacy query alias identical", () => {
    for (const item of cases) {
      expect(item.query, `${item.id} drifted between question and query`).toBe(item.question);
    }
  });

  it("gives every case with an expected top task at least two ranking candidates", () => {
    for (const item of cases) {
      if (!("topTask" in item.expected)) continue;
      expect(item.rankingCandidates.length, `${item.id} cannot be ranked`).toBeGreaterThanOrEqual(2);
      const ids = item.rankingCandidates.map((candidate) => candidate.id);
      expect(ids, `${item.id} expects a top task that is not among its candidates`).toContain(
        (item.expected as { topTask: string }).topTask,
      );
    }
  });
});

describe("metric computation", () => {
  const fast = "fast" as const;
  const thinking = "thinking" as const;
  const synthetic = [
    { id: "a", category: "exact-id", expectedMode: fast, predictedMode: fast, requiredProviders: ["linear"] },
    { id: "b", category: "conflict", expectedMode: thinking, predictedMode: fast, requiredProviders: ["slack", "gmail"] },
    { id: "c", category: "conflict", expectedMode: thinking, predictedMode: thinking, requiredProviders: ["slack"] },
    { id: "d", category: "actor", expectedMode: fast, predictedMode: thinking, requiredProviders: ["linear"] },
  ];

  it("returns the expected shape for a small synthetic input", () => {
    const metrics = computeMetrics(synthetic, ["linear"]);

    expect(metrics).toMatchObject({
      totalCases: 4,
      router: { correct: 2, total: 4, accuracy: 0.5 },
      modeSplit: {
        predicted: { fast: 2, thinking: 2 },
        expected: { fast: 2, thinking: 2 },
      },
      escalation: { predictedThinking: 2, overEscalated: 1, underEscalated: 1 },
      providerCoverage: {
        availableProviders: ["linear"],
        casesWithUnavailableProviders: 2,
        byProvider: { gmail: 1, slack: 2 },
      },
    });

    expect(metrics.perCategory).toEqual({
      "exact-id": { total: 1, correct: 1, accuracy: 1 },
      conflict: { total: 2, correct: 1, accuracy: 0.5 },
      actor: { total: 1, correct: 0, accuracy: 0 },
    });
  });

  it("reports no accuracy rather than a zero for an empty run", () => {
    const metrics = computeMetrics([], []);
    expect(metrics.totalCases).toBe(0);
    expect(metrics.router.accuracy).toBeNull();
    expect(metrics.perCategory).toEqual({});
  });

  it("treats every provider as unavailable when none are declared", () => {
    const metrics = computeMetrics(synthetic, []);
    expect(metrics.providerCoverage.casesWithUnavailableProviders).toBe(4);
    expect(metrics.providerCoverage.byProvider).toEqual({ linear: 2, slack: 2, gmail: 1 });
  });

  it("escapes csv values that contain separators", () => {
    const csv = toCsv([{ id: "a", note: 'says "hi", loudly' }]);
    expect(csv).toBe('id,note\na,"says ""hi"", loudly"');
  });
});
