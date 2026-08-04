import { describe, expect, it, vi } from "vitest";
import { acquireEvidenceFieldContext } from "../app/components/ui/red-plasma";

describe("evidence field WebGL fallback", () => {
  it("marks the atmospheric canvas unavailable and yields to the CSS background", () => {
    const canvas = {
      dataset: {} as DOMStringMap,
      getContext: vi.fn(() => null),
    } as unknown as HTMLCanvasElement;

    expect(acquireEvidenceFieldContext(canvas)).toBeNull();
    expect(canvas.dataset.unavailable).toBe("true");
    expect(canvas.getContext).toHaveBeenCalledWith("webgl", expect.objectContaining({
      antialias: false,
      powerPreference: "low-power",
    }));
  });
});
