import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("new investigation action", () => {
  const app = readFileSync(join(process.cwd(), "app/QueueProofApp.tsx"), "utf8");
  const component = readFileSync(
    join(process.cwd(), "app/components/NewInvestigationLink.tsx"),
    "utf8",
  );
  const css = readFileSync(join(process.cwd(), "app/ember-assistant.css"), "utf8");
  const globals = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
  const baseRule = css.match(/\.new-investigation \{[^}]+\}/)?.[0] ?? "";

  it("reuses one evidence-specific action in the sidebar and history heading", () => {
    expect(app.match(/<NewInvestigationLink/g)).toHaveLength(2);
    expect(app).toContain('<NewInvestigationLink placement="heading" />');
    expect(component).toContain("FileSearch2");
    expect(component).toContain("New investigation");
    expect(component).not.toContain("Plus");
  });

  it("keeps both glyphs at one restrained stroke weight", () => {
    expect(component.match(/strokeWidth=\{1\.8\}/g)).toHaveLength(2);
    expect(component.match(/aria-hidden="true"/g)).toHaveLength(2);
  });

  it("uses a flat technical surface instead of a pill or decorative effect", () => {
    expect(baseRule).toContain("min-height: 46px");
    expect(baseRule).toContain("border-radius: 10px");
    expect(baseRule).toContain("background: var(--panel)");
    expect(baseRule).not.toMatch(/999px|linear-gradient|backdrop-filter|box-shadow/);
    expect(css).toMatch(/\.new-investigation-inline \{[^}]*min-height: 44px/);
  });

  it("aligns the brand, investigation action, and navigation to one rail grid", () => {
    expect(css).toMatch(/\.app-sidebar \.brand \{[^}]*padding:\s*0;/);
    expect(css).toMatch(/\.app-sidebar \.new-investigation \{[^}]*grid-template-columns:\s*36px minmax\(0, 1fr\) 20px/);
    expect(css).toMatch(/\.app-header\.app-sidebar nav > a \{[^}]*grid-template-columns:\s*36px minmax\(0, 1fr\)/);
    expect(css).toContain("@media (min-width: 981px) and (max-height: 780px)");
  });

  it("keeps adjacent high-visibility actions contextual and touch-safe", () => {
    expect(app).toContain("<Link2 size={15} /> Add source");
    expect(app).toContain("<FileCheck2 size={15} /> Prepare a change");
    expect(css).toMatch(/\.mode-control \.mode \{[^}]*min-height: 44px/);
    expect(css).toMatch(/\.answer-actions :is\(button,a\) \{[^}]*min-height: 44px/);
    expect(css).toMatch(/\.client-tabs button \{[^}]*min-height: 44px/);
    expect(globals).toMatch(/button\.citation-chip \{[^}]*width: 28px;[^}]*height: 28px/);
    expect(globals).toContain('button.citation-chip::before { content: ""; position: absolute; inset: -8px; }');
  });

  it("does not render disabled owner controls that only explain themselves on hover", () => {
    expect(app).not.toContain('disabled title="Reconnecting a source is reserved');
    expect(app).not.toContain('disabled title="Preparing a change is reserved');
    expect(app).not.toContain('disabled title="Proposal history is private');
    expect(app).not.toContain('disabled title="Minting a connection key is reserved');
    expect(app).toContain('className="owner-only-label"');
    expect(css).toContain(".owner-only-label {");
  });
});
