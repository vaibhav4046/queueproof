import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "../app/.well-known/oauth-protected-resource/mcp/route";

afterEach(() => vi.unstubAllEnvs());

describe("MCP protected-resource metadata", () => {
  it("advertises the maintained public developer page instead of a dead documentation route", async () => {
    vi.stubEnv("QUEUEPROOF_MCP_AUTH_MODE", "opaque");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.resource).toBe("https://queueproof.vercel.app/mcp");
    expect(body.authorization_servers).toBeUndefined();
    expect(body.resource_documentation).toBe("https://queueproof.vercel.app/developer");
  });

  it("retains the configured authorization server and successful discovery response", async () => {
    vi.stubEnv("QUEUEPROOF_MCP_AUTH_MODE", "hybrid");
    vi.stubEnv("QUEUEPROOF_MCP_RESOURCE", "https://queueproof.vercel.app/mcp");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test_value_123456789");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.authorization_servers).toEqual(["https://project.supabase.co/auth/v1"]);
    expect(body.scopes_supported).toEqual(["openid", "profile", "email"]);
    expect(body.resource).toBe("https://queueproof.vercel.app/mcp");
    expect(body.resource_documentation).toBe("https://queueproof.vercel.app/developer");
  });

  it("enables hybrid discovery for a complete production Marketplace install", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test_value_123456789");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.resource).toBe("https://queueproof.vercel.app/mcp");
    expect(body.authorization_servers).toEqual(["https://project.supabase.co/auth/v1"]);
  });

  it("fails closed when production OAuth is configured for a different resource host", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("QUEUEPROOF_MCP_AUTH_MODE", "hybrid");
    vi.stubEnv("QUEUEPROOF_MCP_RESOURCE", "https://other.example/mcp");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test_value_123456789");

    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body.authorization_servers).toBeUndefined();
    expect(body.resource).toBe("https://queueproof.vercel.app/mcp");
  });
});
