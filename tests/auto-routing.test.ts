import { describe, expect, it } from "vitest";
import {
  decideAutoEscalation,
  providersNamedInQuestion,
  resolveRetrievalMode,
  retrievalModeCost,
} from "../packages/retrieval/src";

describe("Fast-first Auto routing", () => {
  it("starts Auto in Fast without changing explicit mode requests", () => {
    expect(resolveRetrievalMode("auto")).toEqual({ automatic: true, primaryMode: "fast" });
    expect(resolveRetrievalMode(undefined)).toEqual({ automatic: true, primaryMode: "fast" });
    expect(resolveRetrievalMode("fast")).toEqual({ automatic: false, primaryMode: "fast" });
    expect(resolveRetrievalMode("thinking")).toEqual({ automatic: false, primaryMode: "thinking" });
  });

  it.each(["partial", "abstained"] as const)("escalates a %s Fast synthesis", (validationStatus) => {
    expect(decideAutoEscalation({
      validationStatus,
      missingInformation: [],
      namedProviders: [],
      evidenceProviders: ["slack"],
    })).toMatchObject({ escalate: true });
  });

  it("escalates when a requested facet remains unsupported", () => {
    expect(decideAutoEscalation({
      validationStatus: "grounded",
      missingInformation: ["Insufficient evidence for the requested completion state."],
      namedProviders: [],
      evidenceProviders: ["linear"],
    })).toMatchObject({
      escalate: true,
      reasons: ["requested information remained unsupported"],
    });
  });

  it("escalates only for an explicitly named provider that returned no evidence", () => {
    const namedProviders = providersNamedInQuestion(
      "Compare the Linear issue with what Slack says; ignore generic email.",
      ["github", "gmail", "linear", "slack"],
    );
    expect(namedProviders).toEqual(["gmail", "linear", "slack"]);
    expect(decideAutoEscalation({
      validationStatus: "grounded",
      missingInformation: [],
      namedProviders,
      evidenceProviders: ["linear", "slack"],
    })).toMatchObject({
      escalate: true,
      missingNamedProviders: ["gmail"],
    });
  });

  it("keeps a complete, provider-covered answer in Fast", () => {
    expect(decideAutoEscalation({
      validationStatus: "grounded",
      missingInformation: [],
      namedProviders: ["slack", "linear"],
      evidenceProviders: ["github", "linear", "slack"],
    })).toEqual({ escalate: false, reasons: [], missingNamedProviders: [] });
  });

  it("prices mixed execution per call instead of repricing Fast calls as Thinking", () => {
    const modes = ["fast", "fast", "thinking"] as const;
    expect(modes.reduce((total, mode) => total + retrievalModeCost(mode), 0)).toBe(5);
    expect(modes.length * retrievalModeCost("thinking")).toBe(9);
  });
});
