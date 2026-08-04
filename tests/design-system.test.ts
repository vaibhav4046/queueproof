import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("production design system", () => {
  const app = readFileSync(join(process.cwd(), "app/QueueProofApp.tsx"), "utf8");
  const css = readFileSync(join(process.cwd(), "app/command-centre.css"), "utf8");
  const logo = readFileSync(join(process.cwd(), "app/components/QueueProofLogo.tsx"), "utf8");

  it("ships the explicit production marker and command-centre tokens", () => {
    expect(app).toContain('data-design-system="evidence-command-centre-v1"');
    for (const token of ["#070a0f", "#0d131b", "#121a24", "#172230", "#f4f7fb", "#a3adba", "#5ee6a8", "#6d8cff", "#f4ba66", "#ff786c"]) {
      expect(css.toLowerCase()).toContain(token);
    }
  });

  it("keeps the evidence-node Q logo visible and locally owned", () => {
    expect(logo).toContain("QueueProofSymbol");
    expect(logo).toContain("QueueProofLogo");
    expect(logo).toContain("role=\"img\"");
    expect(app).toContain("<QueueProofLogo");
    expect(css).toMatch(/\.queueproof-logo[^}]*opacity:\s*1/);
    expect(css).not.toMatch(/\.queueproof-logo[^}]*display:\s*none/);
  });

  it("protects mobile layout, focus, touch targets, and reduced motion", () => {
    expect(css).toContain("min-height: 44px");
    expect(css).toContain("@media (max-width: 820px)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("outline: 2px solid var(--focus)");
  });
});
