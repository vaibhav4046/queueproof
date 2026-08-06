import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ArrowRight } from "lucide-react";
import { describe, expect, it } from "vitest";
import { ActionButton } from "../components/ui/action-button";

describe("ActionButton", () => {
  it("server-renders a native static QueueProof action", () => {
    const html = renderToStaticMarkup(createElement(ActionButton, {
      label: "Ask QueueProof",
      type: "submit",
      className: "proof-button",
      icon: createElement(ArrowRight, { size: 15 }),
    }));

    expect(html).toContain('type="submit"');
    expect(html).toContain("primary-button action-button proof-button");
    expect(html).toContain("Ask QueueProof");
    expect(html).not.toMatch(/canvas|video|shader/i);
  });

  it("preserves native disabled and loading semantics", () => {
    const html = renderToStaticMarkup(createElement(ActionButton, {
      label: "Build my day",
      loading: true,
      onClick: () => undefined,
    }));

    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Build my day");
  });
});
