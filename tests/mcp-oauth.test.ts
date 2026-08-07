import { beforeAll, describe, expect, it } from "vitest";
import { generateKeyPair, SignJWT } from "jose";
import {
  authenticateSupabaseMcpToken,
  mcpBearerChallenge,
  type McpOAuthConfig,
} from "../lib/server/mcp-auth";
import { requireDb } from "../lib/server/runtime";
import { ensureCoreSchema } from "../lib/server/store";

const config: McpOAuthConfig = {
  mode: "hybrid",
  issuer: "https://project.supabase.co/auth/v1",
  resource: "https://queueproof.vercel.app/mcp",
  jwksUrl: "https://project.supabase.co/auth/v1/.well-known/jwks.json",
  authorizationServer: "https://project.supabase.co/auth/v1",
};

describe("Supabase MCP access tokens", () => {
  let publicKey: CryptoKey;
  let privateKey: CryptoKey;

  beforeAll(async () => {
    await ensureCoreSchema();
    ({ publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true }));
  });

  async function token(input: {
    subject?: string;
    issuer?: string;
    audience?: string;
    scope?: string;
    includeClientId?: boolean;
    permissions?: string[];
  } = {}) {
    return new SignJWT({
      scope: input.scope ?? "openid profile email",
      ...(input.includeClientId === false ? {} : { client_id: "chatgpt-test-client" }),
      ...(input.permissions ? { queueproof_permissions: input.permissions } : {}),
    })
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer(input.issuer ?? config.issuer)
      .setAudience(input.audience ?? config.resource)
      .setSubject(input.subject ?? "00000000-0000-4000-8000-000000000001")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);
  }

  it("accepts a valid signed token and binds it to one persisted workspace client", async () => {
    const authenticated = await authenticateSupabaseMcpToken(await token(), { config, key: publicKey });
    expect(authenticated.scopes).toEqual(["queueproof:read"]);
    expect(authenticated.workspaceId).toMatch(/^ws_external_/);
    expect(authenticated.userId).toMatch(/^user:external:/);
    const client = await requireDb().prepare(
      `SELECT workspace_id AS workspaceId, auth_method AS authMethod,
              external_client_id AS externalClientId, user_id AS userId
       FROM mcp_clients WHERE id = ?`,
    ).bind(authenticated.persistedClientId).first<Record<string, string>>();
    expect(client).toMatchObject({
      workspaceId: authenticated.workspaceId,
      authMethod: "supabase",
      externalClientId: "chatgpt-test-client",
      userId: authenticated.userId,
    });
  });

  it("rejects wrong issuer, wrong audience, and non-OAuth session tokens", async () => {
    await expect(authenticateSupabaseMcpToken(await token({ issuer: "https://attacker.example/" }), {
      config,
      key: publicKey,
    })).rejects.toThrow();
    await expect(authenticateSupabaseMcpToken(await token({ audience: "https://other.example/mcp" }), {
      config,
      key: publicKey,
    })).rejects.toThrow();
    await expect(authenticateSupabaseMcpToken(await token({ includeClientId: false }), {
      config,
      key: publicKey,
    })).rejects.toThrow(/client identifier/i);
  });

  it("accepts only trusted custom QueueProof permission claims", async () => {
    const authenticated = await authenticateSupabaseMcpToken(await token({
      permissions: ["queueproof:propose", "queueproof:sync", "unknown"],
    }), { config, key: publicKey });
    expect(authenticated.scopes).toEqual([
      "queueproof:read",
      "queueproof:propose",
      "queueproof:sync",
    ]);
  });

  it("emits the exact resource-metadata challenge ChatGPT needs", () => {
    expect(mcpBearerChallenge(config.resource, {
      error: "invalid_token",
      description: "Sign in again.",
    })).toBe(
      'Bearer resource_metadata="https://queueproof.vercel.app/.well-known/oauth-protected-resource/mcp", scope="openid profile email", error="invalid_token", error_description="Sign in again."',
    );
  });
});
