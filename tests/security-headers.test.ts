import { describe, expect, it } from "vitest";
import nextConfig, {
  productionSecurityHeaders,
  securityHeaderRules,
} from "../next.config";

const headerMap = Object.fromEntries(
  productionSecurityHeaders.map(({ key, value }) => [key.toLowerCase(), value]),
);

describe("production browser security policy", () => {
  it("disables framework disclosure and applies the policy only to production responses", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
    expect(securityHeaderRules("test")).toEqual([]);
    expect(securityHeaderRules("production")).toEqual([
      { source: "/(.*)", headers: [...productionSecurityHeaders] },
    ]);
  });

  it("blocks framing and dangerous default content capabilities", () => {
    const csp = headerMap["content-security-policy"];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).not.toContain("default-src *");
    expect(headerMap["x-frame-options"]).toBe("DENY");
    expect(headerMap["x-content-type-options"]).toBe("nosniff");
  });

  it("sets explicit referrer, browser capability, and transport policies", () => {
    expect(headerMap["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headerMap["permissions-policy"]).toContain("camera=()");
    expect(headerMap["permissions-policy"]).toContain("microphone=()");
    expect(headerMap["permissions-policy"]).toContain("geolocation=()");
    expect(headerMap["strict-transport-security"]).toContain("max-age=63072000");
  });

  it("does not grant a remote media host for decorative UI", () => {
    const mediaDirective = headerMap["content-security-policy"]
      .split("; ")
      .find((directive) => directive.startsWith("media-src"));

    expect(mediaDirective).toBe("media-src 'self' blob:");
    expect(mediaDirective).not.toContain("https:");
    expect(mediaDirective).not.toContain("*");
  });

  it("allows only the public Supabase API origin family needed by branded auth", () => {
    const csp = headerMap["content-security-policy"];
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("https://*.supabase.co");
    expect(csp).not.toContain("supabase.com");
  });
});
