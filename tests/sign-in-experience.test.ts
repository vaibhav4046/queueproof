import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("QueueProof account and ChatGPT entry experience", () => {
  const root = process.cwd();
  const signIn = readFileSync(join(root, "app/sign-in/page.tsx"), "utf8");
  const signInCss = readFileSync(join(root, "app/sign-in/sign-in.module.css"), "utf8");
  const app = readFileSync(join(root, "app/QueueProofApp.tsx"), "utf8");
  const sidebarCss = readFileSync(join(root, "app/ember-assistant.css"), "utf8");

  it("uses one branded pre-auth route without fake credential or provider fields", () => {
    expect(signIn).toContain("Your work,");
    expect(signIn).toContain("<QueueProofLogo");
    expect(signIn).toContain("<EmberBackdrop");
    expect(signIn).toContain('href={authHref}');
    expect(signIn).toContain('"/auth/login?screen_hint=signup"');
    expect(signIn).not.toMatch(/<input|<form|GoogleIcon|AppleIcon|@paper-design|GrainGradient/);
    expect(signInCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(signInCss).toContain("@media (forced-colors: active)");
    expect(signInCss).toContain("outline: 2px solid var(--auth-ember-bright)");
  });

  it("keeps public account links on the branded route", () => {
    expect(app).toContain('href="/sign-in"');
    expect(app).toContain('href="/sign-in?mode=signup"');
    expect(app).not.toContain('href="/auth/login"');
    expect(app).not.toContain('href="/auth/login?screen_hint=signup"');
  });

  it("makes ChatGPT the primary no-key path and keeps developer tokens collapsed", () => {
    expect(app).toContain('label: "ChatGPT", mobileLabel: "ChatGPT"');
    expect(app).toContain('const CHATGPT_PLUGINS_URL = "https://chatgpt.com/plugins"');
    expect(app).toContain("without creating an API project or pasting a connection key");
    expect(app).toContain("Search QueueProof and select Add");
    expect(app).toContain("OpenAI review, and publisher release remain required before public search.");
    expect(app).toContain('className="advanced-connect"');
    expect(app).toContain("Developer setup for other MCP clients");
  });

  it("fits the desktop rail without creating a hidden scroll dependency", () => {
    expect(sidebarCss).toMatch(/\.app-header\.app-sidebar nav \{[^}]*overflow-y:\s*hidden/);
    expect(sidebarCss).toContain("@media (min-width: 981px) and (max-height: 820px)");
    expect(sidebarCss).toContain("@media (min-width: 981px) and (max-height: 700px)");
    expect(sidebarCss).toMatch(/\.app-header\.app-sidebar nav > a \{[^}]*min-height:\s*44px/);
  });
});
