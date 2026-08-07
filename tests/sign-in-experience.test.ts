import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("QueueProof account and ChatGPT entry experience", () => {
  const root = process.cwd();
  const signIn = readFileSync(join(root, "app/sign-in/page.tsx"), "utf8");
  const signInForm = readFileSync(join(root, "app/sign-in/SignInForm.tsx"), "utf8");
  const callback = readFileSync(join(root, "app/auth/callback/route.ts"), "utf8");
  const signInCss = readFileSync(join(root, "app/sign-in/sign-in.module.css"), "utf8");
  const app = readFileSync(join(root, "app/QueueProofApp.tsx"), "utf8");
  const sidebarCss = readFileSync(join(root, "app/ember-assistant.css"), "utf8");

  it("keeps passwordless account entry on the branded QueueProof route", () => {
    expect(signIn).toContain("Your work,");
    expect(signIn).toContain("<QueueProofLogo");
    expect(signIn).toContain("<EmberBackdrop");
    expect(signIn).toContain("<SignInForm");
    expect(signIn).toContain("publishableKey: config.publishableKey");
    expect(signIn).toContain("enabledSupabaseSocialProviders(config)");
    expect(signIn).not.toMatch(/AppleIcon|@paper-design|GrainGradient|\/auth\/login/);
    expect(signInForm).toContain("signInWithOtp");
    expect(signInForm).toContain("signInWithOAuth");
    expect(signInForm).toContain("socialProviders.map");
    expect(signInForm).toContain("slack_oidc");
    expect(signInForm).not.toContain('provider: "custom:linear"');
    expect(signInForm).toContain("createQueueProofBrowserClient(supabase)");
    expect(signInForm).toContain('type="email"');
    expect(signInForm).toContain('new URL("/auth/callback", window.location.origin)');
    expect(signInForm).not.toMatch(/type="password"|service_role|client_secret/i);
    expect(callback).toContain("exchangeCodeForSession");
    expect(signInCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(signInCss).toContain("@media (forced-colors: active)");
    expect(signInCss).toContain("outline: 2px solid var(--auth-ember-bright)");
  });

  it("provides a branded, read-only-first OAuth consent surface for AI clients", () => {
    const consent = readFileSync(join(root, "app/oauth/authorize/page.tsx"), "utf8");
    expect(consent).toContain("Allow read-only access");
    expect(consent).toContain('action="/api/oauth/approve"');
    expect(consent).toContain('name="decision" value="approve"');
    expect(consent).toContain('name="decision" value="deny"');
    expect(consent).toContain("never gives the client your HydraDB key");
    expect(consent).toContain("<QueueProofLogo");
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
    expect(app).toContain("Personal OAuth, OpenAI review, and publisher release remain separate gates");
    expect(app).toContain("Add this as a custom MCP server with no authentication");
    expect(app).toContain('const demoEndpoint = `${publicOrigin}/mcp/demo`');
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
