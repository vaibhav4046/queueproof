import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("restrained ambient motion", () => {
  const root = process.cwd();
  const app = readFileSync(join(root, "app/QueueProofApp.tsx"), "utf8");
  const css = readFileSync(join(root, "app/ember-assistant.css"), "utf8");
  const globals = readFileSync(join(root, "app/globals.css"), "utf8");
  const action = readFileSync(join(root, "components/ui/action-button.tsx"), "utf8");
  const backdrop = readFileSync(join(root, "components/queueproof/ember-backdrop.tsx"), "utf8");
  const backdropCss = readFileSync(join(root, "components/queueproof/ember-backdrop.module.css"), "utf8");
  const orb = readFileSync(join(root, "app/components/EvidenceOrb.tsx"), "utf8");
  const method = readFileSync(join(root, "app/method/page.tsx"), "utf8");
  const packageJson = readFileSync(join(root, "package.json"), "utf8");
  const lockfile = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");

  function rule(selector: string) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return css.match(new RegExp(`${escaped} \\{[^}]+\\}`))?.[0] ?? "";
  }

  it("keeps one ambient orb loop and reserves the rest for active search", () => {
    expect(rule(".orb-halo")).toContain("animation: orb-breathe");
    for (const selector of [
      ".orb-shell-one",
      ".orb-shell-two",
      ".orb-signal-one",
      ".orb-signal-two",
      ".orb-signal-three",
    ]) {
      expect(rule(selector)).not.toContain("animation:");
    }
    expect(rule(".evidence-orb-searching .orb-shell-one")).toContain("animation: orb-spin");
    expect(rule(".evidence-orb-searching .orb-signal-one")).toContain("animation: signal-one");
    expect(rule(".premium-console::before")).toContain("animation: none !important");
    expect(rule(".empty-command .radar i")).toContain("animation: none !important");
  });

  it("keeps the orb slot stable and expresses result state inside it", () => {
    expect(orb).not.toContain("size?:");
    expect(orb).not.toContain("evidence-orb-compact");
    expect(css).not.toContain(".evidence-orb-compact");
    expect(rule(".evidence-orb-answered .orb-core")).toContain("transform: scale(.72)");
  });

  it("uses static local backdrop texture instead of remote media", () => {
    expect(backdrop).not.toMatch(/<video|useEffect|IntersectionObserver|https?:\/\//);
    expect(backdropCss).not.toMatch(/animation\s*:|transition\s*:|https?:\/\//);
    expect(backdropCss).toContain("radial-gradient");
    expect(app.match(/<EmberBackdrop/g)).toHaveLength(3);
  });

  it("removes shader and motion runtimes rather than hiding them", () => {
    const sources = [app, globals, action, method, packageJson, lockfile].join("\n");
    for (const forbidden of [
      "@paper-design/shaders",
      "LiquidMetalButton",
      "liquid-metal-button",
      "framer-motion",
      "motion-dom",
      "motion-utils",
      "ShaderBackground",
    ]) {
      expect(sources).not.toContain(forbidden);
    }
    expect(action).not.toMatch(/canvas|video|shader/i);
    expect(existsSync(join(root, "app/components/ui/red-plasma.tsx"))).toBe(false);
  });

  it("uses a static CSS active marker instead of a motion runtime", () => {
    expect(app).not.toContain("<motion.span");
    expect(app.match(/<span className="nav-lamp" aria-hidden="true" \/>/g)).toHaveLength(3);
  });

  it("honours reduced motion for scrolling and recorded replay", () => {
    expect(app).toContain("function preferredScrollBehavior()");
    expect(app).not.toMatch(/behavior:\s*"smooth"/);
    expect(app).toContain("if (reducedMotion || !playing || !replaySteps.length) return;");
    expect(app).toContain('reducedMotion ? "Show all"');
    expect(app).toContain("disabled={reducedMotion}");
  });
});
