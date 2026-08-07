import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "../app/.well-known/oauth-protected-resource/mcp/route";
import { QUEUEPROOF_MCP_SCOPES } from "../lib/server/mcp-auth";

afterEach(() => vi.unstubAllEnvs());

const get = (url = "https://queueproof.vercel.app/.well-known/oauth-protected-resource/mcp") =>
  GET(new Request(url));

describe("MCP protected-resource metadata", () => {
  // The previous contract answered 503 whenever Supabase was unconfigured, which told every
  // standards-compliant client that QueueProof had no way to authenticate at all — a client
  // that discovers no authorization server stops rather than prompting a sign-in. QueueProof
  // hosts its own authorization server now, so discovery must always succeed.
  it("advertises an authorization server unconditionally, with no external identity provider configured", async () => {
    const response = await get();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.resource).toBe("https://queueproof.vercel.app/mcp");
    expect(body.authorization_servers).toEqual(["https://queueproof.vercel.app"]);
    expect(body.scopes_supported).toEqual([...QUEUEPROOF_MCP_SCOPES]);
    expect(body.bearer_methods_supported).toEqual(["header"]);
    expect(body.resource_documentation).toBe("https://queueproof.vercel.app/developer");
  });

  it("advertises QueueProof's own scopes rather than the identity provider's", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test_value_123456789");
    const body = await (await get()).json();

    // openid/profile/email are what QueueProof requests *from* Supabase. A client reads this
    // list to decide what to ask the user to grant, and what it needs is queueproof:read.
    expect(body.authorization_servers).toEqual(["https://queueproof.vercel.app"]);
    expect(body.scopes_supported).toContain("queueproof:read");
    expect(body.scopes_supported).not.toContain("openid");
  });

  it("keeps preview and local deployments self-consistent by echoing the request origin", async () => {
    const body = await (await get("https://queueproof-git-preview.vercel.app/.well-known/oauth-protected-resource/mcp")).json();

    expect(body.resource).toBe("https://queueproof-git-preview.vercel.app/mcp");
    expect(body.authorization_servers).toEqual(["https://queueproof-git-preview.vercel.app"]);
  });

  it("pins production to the canonical host so a deployment alias still advertises the discovered issuer", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const body = await (await get("https://queueproof-abc123-vaibhav.vercel.app/.well-known/oauth-protected-resource/mcp")).json();

    // A token minted for the canonical issuer is rejected as audience-mismatched if the
    // client discovered the alias instead, so the alias must not leak into discovery.
    expect(body.resource).toBe("https://queueproof.vercel.app/mcp");
    expect(body.authorization_servers).toEqual(["https://queueproof.vercel.app"]);
  });
});
