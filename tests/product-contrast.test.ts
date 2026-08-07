import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("judge-facing product UI", () => {
  it("keeps contradiction cards on the dark product surface", () => {
    const css = readFileSync(new URL("../app/product.css", import.meta.url), "utf8");
    const rule = css.match(/\.relationship-item\.node-contradiction\s*\{[^}]+\}/)?.[0] ?? "";

    expect(rule).toContain("border-left: 2px solid var(--amber)");
    expect(rule).toContain("background: rgba(166,95,21,.12)");
    expect(rule).not.toMatch(/background:\s*#fff(?:8ef)?/i);
  });

  it("keeps the ember scrollbar above the non-text contrast threshold", () => {
    const css = readFileSync(new URL("../app/ember-assistant.css", import.meta.url), "utf8");

    expect(css).toContain("scrollbar-color: #995020 #050403");
    expect(css).toContain("background: #995020");
    expect(css).not.toContain("background: #5a321b");
  });

  it("labels the anonymous workspace as synthetic Helios data", () => {
    const source = readFileSync(new URL("../app/QueueProofApp.tsx", import.meta.url), "utf8");

    expect(source).toContain("Synthetic Helios demo");
    expect(source).toContain("Synthetic Helios ·");
  });
});
