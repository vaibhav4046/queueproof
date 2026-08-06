import { beforeAll, describe, expect, it } from "vitest";
import { generateKeyPair, SignJWT } from "jose";
import {
  authenticateAuth0McpToken,
  mcpBearerChallenge,
  type McpOAuthConfig,
} from "../lib/server/mcp-auth";
import { requireDb } from "../lib/server/runtime";
import { ensureCoreSchema } from "../lib/server/store";

const config: McpOAuthConfig = {
  mode: "hybrid",
  issuer: "https://tenant.example.auth0.com/",
  resource: "https://queueproof.vercel.app/mcp",
  jwksUrl: "https://tenant.example.auth0.com/.well-known/jwks.json",
};

describe("Auth0 MCP access tokens", () => {
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
  } = {}) {
    return new SignJWT({
      scope: input.scope ?? "queueproof:read",
      client_id: "chatgpt-test-client",
    })
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer(input.issuer ?? config.issuer)
      .setAudience(input.audience ?? config.resource)
      .setSubject(input.subject ?? "auth0|mcp-user")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);
  }

  it("accepts a valid signed token and binds it to one persisted workspace client", async () => {
    const authenticated = await authenticateAuth0McpToken(await token(), { config, key: publicKey });
    expect(authenticated.scopes).toEqual(["queueproof:read"]);
    expect(authenticated.workspaceId).toMatch(/^ws_auth0_/);
    expect(authenticated.userId).toMatch(/^user:auth0:/);
    const client = await requireDb().prepare(
      `SELECT workspace_id AS workspaceId, auth_method AS authMethod,
              external_client_id AS externalClientId, user_id AS userId
       FROM mcp_clients WHERE id = ?`,
    ).bind(authenticated.persistedClientId).first<Record<string, string>>();
    expect(client).toMatchObject({
      workspaceId: authenticated.workspaceId,
      authMethod: "auth0",
      externalClientId: "chatgpt-test-client",
      userId: authenticated.userId,
    });
  });

  it("rejects wrong issuer, wrong audience, and missing read scope", async () => {
    await expect(authenticateAuth0McpToken(await token({ issuer: "https://attacker.example/" }), {
      config,
      key: publicKey,
    })).rejects.toThrow();
    await expect(authenticateAuth0McpToken(await token({ audience: "https://other.example/mcp" }), {
      config,
      key: publicKey,
    })).rejects.toThrow();
    await expect(authenticateAuth0McpToken(await token({ scope: "queueproof:propose" }), {
      config,
      key: publicKey,
    })).rejects.toMatchObject({ status: 403 });
  });

  it("emits the exact resource-metadata challenge ChatGPT needs", () => {
    expect(mcpBearerChallenge(config.resource, {
      error: "invalid_token",
      description: "Sign in again.",
    })).toBe(
      'Bearer resource_metadata="https://queueproof.vercel.app/.well-known/oauth-protected-resource/mcp", scope="queueproof:read", error="invalid_token", error_description="Sign in again."',
    );
  });
});
