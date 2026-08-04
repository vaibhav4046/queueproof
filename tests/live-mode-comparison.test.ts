import { describe, expect, it } from "vitest";
import { compareLiveModes } from "../evals/lib/live-mode-comparison.mjs";

const artifact = (mode: "fast" | "thinking", overrides: Record<string, unknown> = {}) => ({
  status: "measured",
  requestedMode: mode,
  generatedAt: "2026-08-04T12:00:00.000Z",
  target: "https://queueproof.example",
  fixture: "evals/fixtures/live-cases.json",
  release: { commitSha: "abc123", commitRef: "main" },
  latencyMs: { p50: mode === "fast" ? 100 : 300, p95: mode === "fast" ? 200 : 500 },
  calls: { mean: mode === "fast" ? 1 : 2 },
  quality: { requiredFactAccuracy: mode === "fast" ? 0.75 : 1, citationPrecision: 1, citationCompleteness: 1 },
  rows: [{
    id: "case-1", label: "Case 1", apiOk: true, mode, modeHonored: true,
    pass: mode === "thinking", requiredFactRecall: mode === "fast" ? 0.75 : 1,
    latencyMs: mode === "fast" ? 100 : 300, callCount: mode === "fast" ? 1 : 2,
    costUnits: mode === "fast" ? 1 : 6,
  }],
  ...overrides,
});

describe("live Fast versus Thinking comparison", () => {
  it("computes deltas only for the same cases and deployed release", () => {
    const comparison = compareLiveModes(artifact("fast"), artifact("thinking"));
    expect(comparison).toMatchObject({
      status: "measured",
      comparable: true,
      deltas: {
        thinkingMinusFastPasses: 1,
        thinkingMinusFastFactAccuracy: 0.25,
        thinkingMinusFastP50LatencyMs: 200,
        thinkingToFastP50LatencyRatio: 3,
        thinkingMinusFastMeanCalls: 1,
        thinkingMinusFastCostUnits: 5,
      },
    });
  });

  it("refuses to compare artifacts from different releases", () => {
    const thinking = artifact("thinking", { release: { commitSha: "different", commitRef: "main" } });
    expect(compareLiveModes(artifact("fast"), thinking)).toMatchObject({
      status: "incompatible",
      comparable: false,
      deltas: null,
    });
  });

  it("keeps missing mode evidence explicitly unmeasured", () => {
    const placeholder = { status: "not_measured", requestedMode: "fast", rows: [] };
    expect(compareLiveModes(placeholder, placeholder)).toMatchObject({
      status: "not_measured",
      comparable: false,
      deltas: null,
    });
  });
});
