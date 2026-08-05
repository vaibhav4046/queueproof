import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("production design system", () => {
  const app = readFileSync(join(process.cwd(), "app/QueueProofApp.tsx"), "utf8");
  const ember = readFileSync(join(process.cwd(), "app/ember-assistant.css"), "utf8");
  const css = `${readFileSync(join(process.cwd(), "app/command-centre.css"), "utf8")}\n${ember}`;
  const logo = readFileSync(join(process.cwd(), "app/components/QueueProofLogo.tsx"), "utf8");
  const owner = readFileSync(join(process.cwd(), "app/owner/OwnerSignIn.tsx"), "utf8");
  const labRoute = readFileSync(join(process.cwd(), "app/api/lab/route.ts"), "utf8");

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

  it("keeps the daily workflow ahead of developer and judge utilities", () => {
    expect(app).toContain("const workspaceNav = [");
    expect(app).toContain('{ id: "approvals", label: "Review changes"');
    expect(app).toContain('{ id: "agent", label: "Use with AI"');
    expect(app).toContain('className="command-group"');
    expect(app).toContain("Help &amp; ownership");
    expect(app).toContain("Owner settings");
  });

  it("keeps the composer high, source truth compact, and mobile proof unobstructed", () => {
    expect(app).toContain("Ask across your work. Every supported claim links to the exact proof.");
    expect(app).toContain('className="console-source-status"');
    expect(app).toContain('className="source-summary"');
    expect(app).not.toContain("<small>SAFETY</small><strong>Verified only</strong>");
    expect(ember).toContain("grid-template-columns: 112px minmax(0,1fr)");
    expect(ember).toContain(".qp-app:has(.source-proof-layer) .mobile-dock");
    expect(ember).toContain("max-width: none;");
  });

  it("sets an explicit readable floor for operational metadata", () => {
    expect(ember).toContain("Operational metadata must remain readable");
    expect(ember).toContain("font-size: 11px !important");
    expect(ember).toMatch(/\.connector-state small \{[^}]*font-size:\s*11px/);
    expect(ember).toMatch(/\.source-readonly \{[^}]*font-size:\s*12px/);
  });

  it("keeps owner access self-explanatory without exposing a secret", () => {
    expect(owner).toContain('placeholder="Paste QUEUEPROOF_ACCESS_TOKEN"');
    expect(owner).toContain('aria-describedby="owner-token-help"');
    expect(owner).toContain("Environment Variables");
    expect(owner).toContain("replace the value, redeploy");
  });

  it("keeps mobile source proof readable and on the ember palette", () => {
    expect(ember).toMatch(/\.connector-state small \{[^}]*white-space:\s*normal/);
    expect(ember).toMatch(/\.source-proof-sheet \.modal-close \{[^}]*color:\s*var\(--ember-bright\)/);
    expect(ember).toMatch(/\.app-sidebar \.demo-badge \{[^}]*white-space:\s*nowrap/);
  });

  it("uses plain language when current benchmark results are missing", () => {
    expect(app).toContain('"No current results"');
    expect(app).toContain('"Run the live benchmark"');
    expect(labRoute).toContain("No benchmark results have been recorded for this deployed release");
    for (const jargon of ["artifact unbound", "strict artifact", "running commit", "Historical bundled rows", "unmeasured build"]) {
      expect(`${app}\n${labRoute}`).not.toContain(jargon);
    }
  });
});
