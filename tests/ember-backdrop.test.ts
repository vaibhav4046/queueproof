import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EmberBackdrop } from "../components/queueproof/ember-backdrop";

describe("Ember backdrop", () => {
  const wrapper = readFileSync(join(process.cwd(), "components/queueproof/ember-backdrop.tsx"), "utf8");
  const css = readFileSync(join(process.cwd(), "components/queueproof/ember-backdrop.module.css"), "utf8");
  const app = readFileSync(join(process.cwd(), "app/QueueProofApp.tsx"), "utf8");
  const appCss = readFileSync(join(process.cwd(), "app/ember-assistant.css"), "utf8");

  it("server-renders a decorative local evidence texture", () => {
    const html = renderToStaticMarkup(createElement(EmberBackdrop, {
      placement: "connect",
      state: "verifying",
    }));

    expect(html).toContain('data-ember-backdrop=""');
    expect(html).toContain('data-placement="connect"');
    expect(html).toContain('data-state="verifying"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toMatch(/<video|<canvas|src=|https?:\/\//);
  });

  it("can expose the field as an image when it is not decorative", () => {
    const html = renderToStaticMarkup(createElement(EmberBackdrop, {
      decorative: false,
      label: "Evidence texture",
    }));

    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Evidence texture"');
    expect(html).not.toMatch(/<div[^>]*aria-hidden="true"/);
  });

  it("does no media, observer, timer, or client lifecycle work", () => {
    expect(wrapper).not.toContain('"use client"');
    expect(wrapper).not.toMatch(/video|useEffect|IntersectionObserver|requestAnimationFrame|setInterval|https?:\/\//i);
    expect(css).not.toMatch(/animation\s*:|transition\s*:|url\(|https?:\/\//i);
    expect(css).toContain(".fallback");
    expect(css).toContain("radial-gradient");
    expect(css).toMatch(/\.root \{[\s\S]*?position: absolute;/);
    expect(css).toMatch(/\.root \{[\s\S]*?inset: 0;/);
    expect(css).toMatch(/\.root \{[\s\S]*?pointer-events: none;/);
  });

  it("mounts only on selective, isolated product surfaces", () => {
    expect(app).toContain('className="empty-command ember-surface"');
    expect(app).toContain('className="ask-console premium-console ember-surface"');
    expect(app).toContain('className="token-console ember-surface"');
    expect(app.match(/<EmberBackdrop/g)).toHaveLength(3);
    expect(appCss).toContain(".ember-surface > [data-ember-backdrop] ~ *");
  });
});
