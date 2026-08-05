import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "../app/.well-known/oauth-protected-resource/mcp/route";

afterEach(() => vi.unstubAllEnvs());

describe("MCP protected-resource metadata", () => {
  it("advertises the maintained public developer page instead of a dead documentation route", async () => {
    vi.stubEnv("QUEUEPROOF_OAUTH_ISSUER", "");
    const response = await GET(
      new Request("https://queueproof.example/.well-known/oauth-protected-resource/mcp"),
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.resource).toBe("https://queueproof.example/mcp");
    expect(body.resource_documentation).toBe("https://queueproof.example/developer");
  });

  it("retains the configured authorization server and successful discovery response", async () => {
    vi.stubEnv("QUEUEPROOF_OAUTH_ISSUER", "https://identity.example");
    const response = await GET(
      new Request("https://queueproof.example/.well-known/oauth-protected-resource/mcp"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.authorization_servers).toEqual(["https://identity.example"]);
    expect(body.resource_documentation).toBe("https://queueproof.example/developer");
  });
});
