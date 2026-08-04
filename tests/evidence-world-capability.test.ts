import { afterEach, describe, expect, it, vi } from "vitest";
import {
  detectEvidenceWorldCapability,
  EVIDENCE_WORLD_MIN_WIDTH,
} from "../app/components/evidence-world-capability";

type CapabilityOptions = {
  width?: number;
  reducedMotion?: boolean;
  cores?: number;
  memory?: number;
  webgl?: boolean;
};

function installBrowserSignals({
  width = EVIDENCE_WORLD_MIN_WIDTH,
  reducedMotion = false,
  cores = 8,
  memory = 8,
  webgl = true,
}: CapabilityOptions = {}) {
  vi.stubGlobal("window", {
    innerWidth: width,
    WebGLRenderingContext: function WebGLRenderingContext() {},
    matchMedia: () => ({ matches: reducedMotion }),
  });
  vi.stubGlobal("navigator", { hardwareConcurrency: cores, deviceMemory: memory });
  vi.stubGlobal("document", {
    createElement: () => ({ getContext: () => webgl ? {} : null }),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("EvidenceWorld capability gate", () => {
  it("allows a capable desktop with a real WebGL context", () => {
    installBrowserSignals();
    expect(detectEvidenceWorldCapability()).toBe(true);
  });

  it("fails closed below the SVG scene breakpoint", () => {
    installBrowserSignals({ width: EVIDENCE_WORLD_MIN_WIDTH - 1 });
    expect(detectEvidenceWorldCapability()).toBe(false);
  });

  it("uses the semantic fallback when reduced motion is requested", () => {
    installBrowserSignals({ reducedMotion: true });
    expect(detectEvidenceWorldCapability()).toBe(false);
  });

  it("rejects very low-end devices", () => {
    installBrowserSignals({ cores: 2 });
    expect(detectEvidenceWorldCapability()).toBe(false);
  });

  it("does not mount a dead canvas when WebGL context creation fails", () => {
    installBrowserSignals({ webgl: false });
    expect(detectEvidenceWorldCapability()).toBe(false);
  });
});
