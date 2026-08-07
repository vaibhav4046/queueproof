import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("relationship-map contrast", () => {
  it("keeps contradiction cards on the dark product surface", () => {
    const css = readFileSync(new URL("../app/product.css", import.meta.url), "utf8");
    const rule = css.match(/\.relationship-item\.node-contradiction\s*\{[^}]+\}/)?.[0] ?? "";

    expect(rule).toContain("border-left: 2px solid var(--amber)");
    expect(rule).toContain("background: rgba(166,95,21,.12)");
    expect(rule).not.toMatch(/background:\s*#fff(?:8ef)?/i);
  });
});
