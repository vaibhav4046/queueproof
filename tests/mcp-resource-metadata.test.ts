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
    vi.stubEnv("AUTH0_DOMAIN", "tenant.example.auth0.com");
    vi.stubEnv("AUTH0_CLIENT_ID", "test-client");
    vi.stubEnv("AUTH0_CLIENT_SECRET", "test-client-secret");
    vi.stubEnv("AUTH0_SECRET", "a".repeat(64));
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.authorization_servers).toEqual(["https://tenant.example.auth0.com/"]);
    expect(body.resource).toBe("https://queueproof.vercel.app/mcp");
    expect(body.resource_documentation).toBe("https://queueproof.vercel.app/developer");
  });

  it("enables hybrid discovery for a complete production Marketplace install", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("AUTH0_DOMAIN", "tenant.example.auth0.com");
    vi.stubEnv("AUTH0_CLIENT_ID", "test-client");
    vi.stubEnv("AUTH0_CLIENT_SECRET", "test-client-secret");
    vi.stubEnv("AUTH0_SECRET", "a".repeat(64));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.resource).toBe("https://queueproof.vercel.app/mcp");
    expect(body.authorization_servers).toEqual(["https://tenant.example.auth0.com/"]);
  });
});
