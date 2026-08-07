import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("production design system", () => {
  const app = readFileSync(join(process.cwd(), "app/QueueProofApp.tsx"), "utf8");
  const layout = readFileSync(join(process.cwd(), "app/layout.tsx"), "utf8");
  const manifest = readFileSync(join(process.cwd(), "app/manifest.ts"), "utf8");
  const ember = readFileSync(join(process.cwd(), "app/ember-assistant.css"), "utf8");
  const css = `${readFileSync(join(process.cwd(), "app/command-centre.css"), "utf8")}\n${ember}`;
  const logo = readFileSync(join(process.cwd(), "app/components/QueueProofLogo.tsx"), "utf8");
  const dates = readFileSync(join(process.cwd(), "app/date-label.ts"), "utf8");
  const signInCss = readFileSync(join(process.cwd(), "app/sign-in/sign-in.module.css"), "utf8");
  const legalCss = readFileSync(join(process.cwd(), "app/legal/legal.module.css"), "utf8");
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

  it("uses the same cache-busted Q and ember check across browser and installed icons", () => {
    const favicon = readFileSync(join(process.cwd(), "public/queueproof-favicon-v2.svg"), "utf8");
    const fallbackFavicon = readFileSync(join(process.cwd(), "public/favicon.svg"), "utf8");
    const appIcon = readFileSync(join(process.cwd(), "public/queueproof-app-icon-v2.svg"), "utf8");
    const canonicalQ = "M25.8 25.2A10.8 10.8 0 1 1 28.8 18c0 2.8-1 5.3-2.7 7.2l4.3 4.1";

    expect(logo).toContain(canonicalQ);
    expect(favicon).toContain(canonicalQ);
    expect(fallbackFavicon).toContain(canonicalQ);
    expect(appIcon).toContain(canonicalQ);
    expect(favicon).toContain("#FF6A00");
    expect(favicon).not.toMatch(/#5EE6A8|#14875C/i);

    for (const path of [
      "/queueproof-favicon-v2.svg",
      "/queueproof-favicon-v2-32.png",
      "/queueproof-favicon-v2.ico",
      "/queueproof-apple-touch-icon-v2.png",
    ]) {
      expect(layout).toContain(path);
    }
    expect(layout).toContain('manifest: "/manifest.webmanifest"');
    expect(manifest).toContain('/queueproof-icon-v2-192.png');
    expect(manifest).toContain('/queueproof-icon-v2-512.png');

    for (const [path, expected] of [
      ["public/queueproof-favicon-v2-32.png", [32, 32]],
      ["public/queueproof-apple-touch-icon-v2.png", [180, 180]],
      ["public/queueproof-icon-v2-192.png", [192, 192]],
      ["public/queueproof-icon-v2-512.png", [512, 512]],
    ] as const) {
      const png = readFileSync(join(process.cwd(), path));
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual(expected);
    }

    const faviconPng = readFileSync(join(process.cwd(), "public/queueproof-favicon-v2-32.png"));
    const applePng = readFileSync(join(process.cwd(), "public/queueproof-apple-touch-icon-v2.png"));
    expect(faviconPng.readUInt8(25)).toBe(6);
    expect(applePng.readUInt8(25)).toBe(2);

    const ico = readFileSync(join(process.cwd(), "public/queueproof-favicon-v2.ico"));
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(3);
    expect(readFileSync(join(process.cwd(), "public/favicon.ico"))).toEqual(ico);
  });

  it("protects mobile layout, focus, touch targets, and reduced motion", () => {
    expect(css).toContain("min-height: 44px");
    expect(css).toContain("@media (max-width: 820px)");
    expect(css).toContain("@media (max-width: 980px), (max-height: 620px)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("outline: 2px solid var(--focus)");
    expect(css).toContain("outline: 2px solid var(--ember-bright)");
    expect(signInCss).toMatch(/\.helpLinks a \{[^}]*min-height:\s*44px/);
    expect(legalCss).toMatch(/\.back \{\s*width:\s*44px;\s*justify-content:\s*center;/);
    expect(app).toContain('aria-label="Close source setup"');
    expect(app).toContain('aria-label="Close approval details"');
  });

  it("keeps long proof surfaces branded and proportionate on 4K canvases", () => {
    expect(ember).toContain("scrollbar-color: #995020 #050403");
    expect(ember).toContain("*::-webkit-scrollbar-thumb");
    expect(ember).toContain("@media (min-width: 1920px)");
    expect(ember).toMatch(/\.proof-screen \{ width:\s*min\(1180px, 100%\)/);
    expect(ember).toContain("* { scrollbar-color: auto; }");
  });

  it("keeps account identity and sign-out reachable from the mobile header", () => {
    expect(app).toContain('<AccountControl actor={view.actor} workspaceId={view.workspace.id} mobile verifiedCount={verified.length} />');
    expect(app).toContain('mobile-account-menu');
    expect(app).toContain('window.localStorage.removeItem(recentInvestigationsKey(workspaceId))');
    expect(app).toContain('router.push("/auth/logout")');
    expect(ember).toMatch(/\.mobile-account-menu > summary \{[^}]*min-height:\s*44px/);
    expect(ember).toMatch(/\.mobile-account-menu \.account-popover \{[^}]*inset:\s*calc\(100% \+ 7px\)/);
  });

  it("keeps server-rendered date text independent of the browser timezone", () => {
    expect(app).toContain('import { dateLabel } from "./date-label"');
    expect(app).not.toContain("function dateLabel(");
    expect(dates).toContain("normaliseUtcTimestamp(value)");
    expect(dates).toContain('timeZone: "UTC"');
  });

  it("keeps evidence work conversational without hiding proof or safe actions", () => {
    expect(app).toContain('className="investigation-thread"');
    expect(app).toContain("Ask a follow-up");
    expect(app).toContain("Open receipts");
    expect(app).toContain("Prepare a change");
    expect(app).toContain('id="answer-sources"');
    expect(css).toContain(".answer-actions");
  });

  it("labels abstained retrieval candidates as rejected rather than proof", () => {
    expect(app).toContain('result?.validation.status === "abstained" ? result.evidence : []');
    expect(app).toContain('resultTone !== "abstained"');
    expect(app).toContain("retrieved candidate");
    expect(app).toContain("rejected as insufficient");
    expect(app).toContain("They are not citations or sources behind an answer.");
  });

  it("keeps the daily workflow ahead of developer and judge utilities", () => {
    expect(app).toContain("const workspaceNav = [");
    expect(app).toContain('{ id: "approvals", label: "Review changes"');
    expect(app).toContain('{ id: "agent", label: "ChatGPT"');
    expect(app).toContain('className="command-group"');
    expect(app).toContain("<h2>Help</h2>");
    expect(app).toContain('<Link href="/support" onClick={onClose}>');
    expect(app).toContain('<Link href="/privacy" onClick={onClose}>');
    expect(app).toContain('<Link href="/terms" onClick={onClose}>');
  });

  it("never gates a visitor behind an owner sign-in prompt", () => {
    // Anyone opening the link gets the whole workspace. Owner-only controls render as
    // disabled affordances with a plain reason, not as a route to a token wall.
    expect(app).not.toContain('href="/owner"');
    expect(app).not.toContain("Owner sign in");
    expect(app).not.toContain("sandbox-disclosure");
    expect(app).toContain("reserved to the workspace owner");
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

  it("fails benchmark readiness closed on irrelevant claims and shows the proof", () => {
    expect(app).toContain("type BenchmarkQuality =");
    expect(app).toContain("relevancePrecision?: number");
    expect(app).toContain("irrelevantClaimRate?: number");
    expect(app).toContain("zeroIrrelevantClaims?: boolean");
    expect(app).toContain("const perfectRelevance");
    expect(app).toContain("&& liveRelevanceMet && pdfGatesMet;");
    expect(app).toContain("const pdfGatesMet");
    expect(app).toContain("CLAIM RELEVANCE");
    expect(app).toContain("CITATIONS + RELEVANCE");
    expect(app).toContain("Cross-source:");
    expect(labRoute).toContain('"relevancePass", "relevancePrecision", "irrelevantClaimRate"');
    expect(labRoute).not.toContain('"answer", "question", "irrelevantClaims"');
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
