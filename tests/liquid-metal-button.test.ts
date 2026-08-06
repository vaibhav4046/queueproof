import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ArrowRight } from "lucide-react";
import { describe, expect, it } from "vitest";
import { LiquidMetalButton } from "../components/ui/liquid-metal-button";

describe("LiquidMetalButton", () => {
  it("server-renders a usable orange/black fallback without a canvas", () => {
    const html = renderToStaticMarkup(createElement(LiquidMetalButton, {
      label: "Ask QueueProof",
      type: "submit",
      className: "proof-button",
      icon: createElement(ArrowRight, { size: 15 }),
    }));

    expect(html).toContain("data-shader=\"fallback\"");
    expect(html).toContain("type=\"submit\"");
    expect(html).toContain("liquid-metal-button proof-button");
    expect(html).toContain("Ask QueueProof");
    expect(html).not.toContain("<canvas");
  });

  it("preserves native disabled and loading semantics", () => {
    const html = renderToStaticMarkup(createElement(LiquidMetalButton, {
      label: "Build my day",
      loading: true,
      onClick: () => undefined,
    }));

    expect(html).toContain("disabled=\"\"");
    expect(html).toContain("aria-busy=\"true\"");
    expect(html).toContain("Build my day");
  });

  it("gives icon-only mode an accessible name", () => {
    const html = renderToStaticMarkup(createElement(LiquidMetalButton, {
      label: "Open proof",
      iconOnly: true,
      icon: createElement(ArrowRight, { size: 15 }),
    }));

    expect(html).toContain("aria-label=\"Open proof\"");
    expect(html).toContain("liquid-metal-button--icon");
    expect(html).toContain("<span class=\"sr-only\">Open proof</span>");
  });
});
