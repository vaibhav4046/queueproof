import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("production design system", () => {
  const app = readFileSync(join(process.cwd(), "app/QueueProofApp.tsx"), "utf8");
  const css = `${readFileSync(join(process.cwd(), "app/command-centre.css"), "utf8")}\n${readFileSync(join(process.cwd(), "app/ember-assistant.css"), "utf8")}`;
  const logo = readFileSync(join(process.cwd(), "app/components/QueueProofLogo.tsx"), "utf8");

  it("ships the explicit Ember Assistant marker and black-orange tokens", () => {
    expect(app).toContain('data-design-system="ember-assistant-v1"');
    for (const token of ["#050403", "#070605", "#0b0907", "#120e0b", "#faf7f2", "#c0b7af", "#ff6a00", "#ff9a42", "#ffd1aa"]) {
      expect(css.toLowerCase()).toContain(token);
    }
  });

  it("keeps the simplified converging-signal Q visible and locally owned", () => {
    expect(logo).toContain("QueueProofSymbol");
    expect(logo).toContain("QueueProofLogo");
    expect(logo).toContain("role=\"img\"");
    expect(app).toContain("<QueueProofLogo");
    expect(css).toMatch(/\.queueproof-logo[^}]*opacity:\s*1/);
    expect(css).not.toMatch(/\.queueproof-logo[^}]*display:\s*none/);
    expect(logo).not.toContain("LIVE");
  });

  it("protects mobile layout, focus, touch targets, and reduced motion", () => {
    expect(css).toContain("min-height: 44px");
    expect(css).toContain("@media (max-width: 820px)");
    expect(css).toContain("@media (max-width: 980px)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("outline: 2px solid var(--focus)");
    expect(css).toContain("outline: 2px solid var(--ember-bright)");
  });

  it("keeps evidence work conversational without hiding proof or safe actions", () => {
    expect(app).toContain('className="investigation-thread"');
    expect(app).toContain("Ask a follow-up");
    expect(app).toContain("Open receipts");
    expect(app).toContain("Prepare a change");
    expect(app).toContain('id="answer-sources"');
    expect(css).toContain(".answer-actions");
  });
});
