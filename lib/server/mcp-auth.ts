import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTVerifyGetKey,
  type KeyInput,
} from "jose";
import { auth0Config } from "./auth0";
import { ensureExternalPrincipalWorkspace } from "./auth-principal";
import { requireDb, runtimeEnv } from "./runtime";
import { ensureCoreSchema } from "./store";
import { sha256 } from "../../packages/security/src";

export type McpAuthMode = "opaque" | "hybrid" | "auth0";

export const QUEUEPROOF_MCP_RESOURCE = "https://queueproof.vercel.app/mcp";

export const QUEUEPROOF_MCP_SCOPES = [
  "queueproof:read",
  "queueproof:propose",
  "queueproof:sync",
] as const;

export type QueueProofMcpScope = (typeof QUEUEPROOF_MCP_SCOPES)[number];

export type McpOAuthConfig = {
  mode: "hybrid" | "auth0";
  resource: string;
  issuer: string;
  jwksUrl: string;
};

export type McpAuthentication = {
  workspaceId: string;
  userId: string;
  clientId: string;
  persistedClientId: string;
  scopes: QueueProofMcpScope[];
  authMethod: "auth0";
};

function value(env: Record<string, unknown>, key: string): string {
  return typeof env[key] === "string" ? String(env[key]).trim() : "";
}

export function mcpAuthMode(
  env: Record<string, unknown> = runtimeEnv() as Record<string, unknown>,
): McpAuthMode {
  const mode = value(env, "QUEUEPROOF_MCP_AUTH_MODE");
  if (mode === "opaque" || mode === "hybrid" || mode === "auth0") return mode;
  // A complete Marketplace install is an intentional production rollout. Hybrid keeps
  // existing opaque clients working while adding the strictly verified OAuth path.
  return value(env, "VERCEL_ENV") === "production" && auth0Config(env) ? "hybrid" : "opaque";
}

export function mcpOAuthConfig(
  env: Record<string, unknown> = runtimeEnv() as Record<string, unknown>,
): McpOAuthConfig | null {
  const mode = mcpAuthMode(env);
  const web = auth0Config(env);
  if ((mode !== "hybrid" && mode !== "auth0") || !web) return null;
  try {
    const configuredResource = value(env, "QUEUEPROOF_MCP_RESOURCE");
    const resourceUrl = new URL(
      configuredResource || (value(env, "VERCEL_ENV") === "production" ? QUEUEPROOF_MCP_RESOURCE : ""),
    );
    if (
      resourceUrl.protocol !== "https:" ||
      resourceUrl.pathname !== "/mcp" ||
      resourceUrl.search ||
      resourceUrl.hash ||
      (value(env, "VERCEL_ENV") === "production" && resourceUrl.toString() !== QUEUEPROOF_MCP_RESOURCE)
    ) return null;
    return {
      mode,
      resource: resourceUrl.toString(),
      issuer: web.issuer,
      jwksUrl: new URL(".well-known/jwks.json", web.issuer).toString(),
    };
  } catch {
    return null;
  }
}

export function mcpResourceMetadataUrl(resource: string): string {
  const resourceUrl = new URL(resource);
  return new URL("/.well-known/oauth-protected-resource/mcp", resourceUrl.origin).toString();
}

export function mcpBearerChallenge(
  resource: string,
  options: { error?: "invalid_token" | "insufficient_scope"; description?: string } = {},
): string {
  const fields = [
    `resource_metadata="${mcpResourceMetadataUrl(resource)}"`,
    `scope="queueproof:read"`,
  ];
  if (options.error) fields.push(`error="${options.error}"`);
  if (options.description) {
    const safeDescription = options.description.replace(/["\\\r\n]/g, " ").slice(0, 180);
    fields.push(`error_description="${safeDescription}"`);
  }
  return `Bearer ${fields.join(", ")}`;
}

const remoteKeys = new Map<string, JWTVerifyGetKey>();

function remoteJwks(url: string): JWTVerifyGetKey {
  const existing = remoteKeys.get(url);
  if (existing) return existing;
  const created = createRemoteJWKSet(new URL(url), {
    timeoutDuration: 5_000,
    cooldownDuration: 30_000,
    cacheMaxAge: 10 * 60_000,
  });
  remoteKeys.set(url, created);
  return created;
}

function tokenScopes(payload: Record<string, unknown>): QueueProofMcpScope[] {
  const declared = new Set<string>();
  if (typeof payload.scope === "string") {
    for (const scope of payload.scope.split(/\s+/)) if (scope) declared.add(scope);
  }
  if (Array.isArray(payload.permissions)) {
    for (const permission of payload.permissions) {
      if (typeof permission === "string") declared.add(permission);
    }
  }
  return QUEUEPROOF_MCP_SCOPES.filter((scope) => declared.has(scope));
}

type VerificationKey = JWTVerifyGetKey | KeyInput;

/** Verify a signed Auth0 access token and bind it to one QueueProof workspace. */
export async function authenticateAuth0McpToken(
  token: string,
  options: { config?: McpOAuthConfig; key?: VerificationKey } = {},
): Promise<McpAuthentication> {
  const config = options.config ?? mcpOAuthConfig();
  if (!config) throw new Error("QueueProof OAuth MCP authentication is not configured.");
  if (token.split(".").length !== 3) throw new Error("The bearer token is not a JWT.");

  const verified = await jwtVerify(
    token,
    options.key ?? remoteJwks(config.jwksUrl),
    {
      algorithms: ["RS256"],
      issuer: config.issuer,
      audience: config.resource,
      requiredClaims: ["sub", "exp", "iat"],
      clockTolerance: 5,
    },
  );
  const subject = typeof verified.payload.sub === "string" ? verified.payload.sub : "";
  if (!subject) throw new Error("The access token has no subject.");
  const scopes = tokenScopes(verified.payload as Record<string, unknown>);
  if (!scopes.includes("queueproof:read")) {
    throw new Response("The access token is missing queueproof:read.", { status: 403 });
  }

  const principal = await ensureExternalPrincipalWorkspace({
    issuer: config.issuer,
    subject,
  });
  const externalClientId = [verified.payload.azp, verified.payload.client_id]
    .find((candidate): candidate is string => typeof candidate === "string" && candidate.length > 0)
    ?.slice(0, 500) ?? "oauth-client";
  const clientDigest = await sha256(`${config.issuer}\0${externalClientId}\0${principal.userId}`);
  const persistedClientId = `mcp_auth0_${clientDigest.slice(0, 32)}`;

  await ensureCoreSchema();
  const db = requireDb();
  await db.prepare(
    `INSERT OR IGNORE INTO mcp_clients
     (id, workspace_id, client_type, scopes_json, status, auth_method, auth_issuer,
      external_client_id, user_id, last_handshake_at)
     VALUES (?, ?, 'chatgpt-oauth', ?, 'connected', 'auth0', ?, ?, ?, CURRENT_TIMESTAMP)`,
  ).bind(
    persistedClientId,
    principal.workspaceId,
    JSON.stringify(scopes),
    config.issuer,
    externalClientId,
    principal.userId,
  ).run();
  await db.prepare(
    `UPDATE mcp_clients SET scopes_json = ?, status = 'connected',
       last_handshake_at = COALESCE(last_handshake_at, CURRENT_TIMESTAMP),
       updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND workspace_id = ? AND user_id = ?`,
  ).bind(JSON.stringify(scopes), persistedClientId, principal.workspaceId, principal.userId).run();

  return {
    workspaceId: principal.workspaceId,
    userId: principal.userId,
    clientId: externalClientId,
    persistedClientId,
    scopes,
    authMethod: "auth0",
  };
}
