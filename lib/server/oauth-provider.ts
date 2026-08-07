import { requireDb } from "./runtime";
import { ensureCoreSchema } from "./store";
import { sha256 } from "../../packages/security/src";
import { QUEUEPROOF_MCP_SCOPES, type QueueProofMcpScope } from "./mcp-auth";

/**
 * QueueProof's own OAuth 2.1 authorization server.
 *
 * The deployment previously advertised Supabase as its authorization server, but that
 * project's OAuth server is switched off and exposes no dynamic-registration endpoint.
 * Every MCP client that cannot be pre-registered — Claude connectors, ChatGPT connectors,
 * `mcp-remote` — therefore failed with a client-registration error before a single
 * request reached QueueProof. Hosting the authorization server here removes that
 * dependency entirely: discovery, registration, consent, and token issuance are all
 * served from the same origin as the protected resource.
 *
 * Design constraints, in the order they matter:
 *  - Public clients only, PKCE S256 mandatory. No client secret is ever issued, so a
 *    leaked registration cannot be replayed without the matching verifier.
 *  - Authorization codes are single-use, short-lived, and stored only as hashes.
 *  - The workspace on a token comes from the consenting signed-in user, never from a
 *    request parameter, so a client cannot name a workspace it has no claim to.
 */

export const AUTHORIZATION_CODE_TTL_MS = 60_000;
export const ACCESS_TOKEN_TTL_MS = 30 * 24 * 60 * 60_000;
const MAX_REDIRECT_URIS = 12;

/** Loopback redirects are how CLI and desktop MCP clients complete a browser flow. */
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export type RegisteredClient = {
  clientId: string;
  clientName: string;
  redirectUris: string[];
  registeredAt: string;
};

export class OAuthError extends Error {
  constructor(
    readonly code: string,
    readonly description: string,
    readonly status = 400,
  ) {
    super(description);
    this.name = "OAuthError";
  }
}

function base64Url(bytes: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomToken(prefix: string, byteLength: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${hex}`;
}

/**
 * A redirect target is accepted when it is https, a loopback address, or a private
 * scheme registered by a desktop client. Plain http to a remote host is rejected: an
 * authorization code in cleartext over the network is the classic interception.
 */
export function isAllowedRedirectUri(candidate: string): boolean {
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return false;
  }
  if (url.hash) return false;
  if (url.protocol === "https:") return true;
  if (url.protocol === "http:") return LOOPBACK_HOSTS.has(url.hostname);
  // Custom schemes must look like a real application identifier, never `javascript:`.
  return /^[a-z][a-z0-9+.-]*:$/.test(url.protocol) &&
    !["javascript:", "data:", "vbscript:", "file:"].includes(url.protocol);
}

export function normaliseScopes(requested: string | null | undefined): QueueProofMcpScope[] {
  if (!requested) return ["queueproof:read"];
  const asked = new Set(requested.split(/\s+/).filter(Boolean));
  const granted = QUEUEPROOF_MCP_SCOPES.filter((scope) => asked.has(scope));
  // Read access is the floor. A client that asks for nothing recognisable still gets a
  // usable read-only connection instead of a token that can do nothing at all.
  return granted.length > 0 ? granted : ["queueproof:read"];
}

export async function registerClient(input: {
  clientName?: unknown;
  redirectUris?: unknown;
}): Promise<RegisteredClient> {
  const rawUris = Array.isArray(input.redirectUris) ? input.redirectUris : [];
  const redirectUris = rawUris
    .filter((uri): uri is string => typeof uri === "string" && uri.length > 0 && uri.length <= 2000)
    .slice(0, MAX_REDIRECT_URIS);
  if (redirectUris.length === 0) {
    throw new OAuthError("invalid_redirect_uri", "At least one redirect_uri is required.");
  }
  const rejected = redirectUris.find((uri) => !isAllowedRedirectUri(uri));
  if (rejected) {
    throw new OAuthError(
      "invalid_redirect_uri",
      "Every redirect_uri must be https, a loopback address, or a private application scheme.",
    );
  }
  const clientName = typeof input.clientName === "string" && input.clientName.trim()
    ? input.clientName.trim().slice(0, 120)
    : "MCP client";
  const clientId = randomToken("qpc", 16);
  const registeredAt = new Date().toISOString();

  await ensureCoreSchema();
  await requireDb().prepare(
    `INSERT INTO mcp_clients
       (id, workspace_id, client_type, scopes_json, status, auth_method,
        client_name, redirect_uris_json, registered_at)
     VALUES (?, 'unbound', 'oauth-dcr', ?, 'registered', 'queueproof-oauth', ?, ?, ?)`,
  ).bind(
    clientId,
    JSON.stringify(["queueproof:read"]),
    clientName,
    JSON.stringify(redirectUris),
    registeredAt,
  ).run();

  return { clientId, clientName, redirectUris, registeredAt };
}

export async function loadClient(clientId: string): Promise<RegisteredClient | null> {
  if (!clientId || clientId.length > 200) return null;
  await ensureCoreSchema();
  const row = await requireDb().prepare(
    `SELECT id, client_name AS clientName, redirect_uris_json AS redirectUrisJson,
            registered_at AS registeredAt
     FROM mcp_clients WHERE id = ? AND auth_method = 'queueproof-oauth' LIMIT 1`,
  ).bind(clientId).first<{
    id: string;
    clientName: string | null;
    redirectUrisJson: string | null;
    registeredAt: string | null;
  }>();
  if (!row?.redirectUrisJson) return null;
  let redirectUris: string[] = [];
  try {
    const parsed = JSON.parse(row.redirectUrisJson) as unknown;
    if (Array.isArray(parsed)) redirectUris = parsed.filter((uri): uri is string => typeof uri === "string");
  } catch {
    return null;
  }
  return {
    clientId: row.id,
    clientName: row.clientName ?? "MCP client",
    redirectUris,
    registeredAt: row.registeredAt ?? "",
  };
}

export type AuthorizationRequest = {
  client: RegisteredClient;
  redirectUri: string;
  codeChallenge: string;
  scopes: QueueProofMcpScope[];
  state: string | null;
  resource: string | null;
};

/**
 * Validate an /oauth/authorize query string before any consent screen is drawn.
 *
 * `redirect_uri` is checked against the registration by exact string match rather than
 * by prefix or origin: a prefix match lets an open redirect on the client's own domain
 * become a code-exfiltration path.
 */
export async function parseAuthorizationRequest(
  params: URLSearchParams,
): Promise<AuthorizationRequest> {
  const clientId = params.get("client_id") ?? "";
  const client = await loadClient(clientId);
  if (!client) throw new OAuthError("invalid_client", "Unknown client_id. Register the client first.");

  const redirectUri = params.get("redirect_uri") ?? "";
  if (!redirectUri || !client.redirectUris.includes(redirectUri)) {
    throw new OAuthError(
      "invalid_request",
      "redirect_uri does not exactly match a value from this client's registration.",
    );
  }
  if (params.get("response_type") !== "code") {
    throw new OAuthError("unsupported_response_type", "Only response_type=code is supported.");
  }
  if (params.get("code_challenge_method") !== "S256") {
    throw new OAuthError("invalid_request", "PKCE with code_challenge_method=S256 is required.");
  }
  const codeChallenge = params.get("code_challenge") ?? "";
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(codeChallenge)) {
    throw new OAuthError("invalid_request", "code_challenge is missing or malformed.");
  }
  const state = params.get("state");
  return {
    client,
    redirectUri,
    codeChallenge,
    scopes: normaliseScopes(params.get("scope")),
    state: state && state.length <= 500 ? state : null,
    resource: params.get("resource"),
  };
}

/** Mint a single-use code for a consenting, signed-in user. */
export async function issueAuthorizationCode(input: {
  request: AuthorizationRequest;
  workspaceId: string;
  userId: string;
}): Promise<string> {
  const code = randomToken("qpa", 32);
  const expiresAt = new Date(Date.now() + AUTHORIZATION_CODE_TTL_MS).toISOString();
  await ensureCoreSchema();
  await requireDb().prepare(
    `INSERT INTO mcp_authorization_codes
       (code_hash, client_id, workspace_id, user_id, redirect_uri, code_challenge,
        scopes_json, resource, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    await sha256(code),
    input.request.client.clientId,
    input.workspaceId,
    input.userId,
    input.request.redirectUri,
    input.request.codeChallenge,
    JSON.stringify(input.request.scopes),
    input.request.resource,
    expiresAt,
  ).run();
  return code;
}

export type IssuedToken = {
  accessToken: string;
  expiresInSeconds: number;
  scopes: QueueProofMcpScope[];
};

/**
 * Redeem an authorization code.
 *
 * The consume step is an UPDATE guarded by `consumed_at IS NULL`, and the token is only
 * minted when that UPDATE reports a row change. Reading the row and writing it back
 * would leave a window in which two concurrent redemptions of the same code both
 * succeed; letting the database arbitrate closes it.
 */
export async function redeemAuthorizationCode(input: {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
  audience: string;
}): Promise<IssuedToken> {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(input.codeVerifier)) {
    throw new OAuthError("invalid_grant", "code_verifier is missing or malformed.");
  }
  await ensureCoreSchema();
  const db = requireDb();
  const codeHash = await sha256(input.code);
  const row = await db.prepare(
    `SELECT client_id AS clientId, workspace_id AS workspaceId, user_id AS userId,
            redirect_uri AS redirectUri, code_challenge AS codeChallenge,
            scopes_json AS scopesJson
     FROM mcp_authorization_codes
     WHERE code_hash = ? AND consumed_at IS NULL AND datetime(expires_at) > CURRENT_TIMESTAMP
     LIMIT 1`,
  ).bind(codeHash).first<{
    clientId: string;
    workspaceId: string;
    userId: string;
    redirectUri: string;
    codeChallenge: string;
    scopesJson: string;
  }>();
  if (!row) throw new OAuthError("invalid_grant", "The authorization code is unknown, used, or expired.");
  if (row.clientId !== input.clientId) {
    throw new OAuthError("invalid_grant", "The authorization code was issued to a different client.");
  }
  if (row.redirectUri !== input.redirectUri) {
    throw new OAuthError("invalid_grant", "redirect_uri does not match the authorization request.");
  }
  const verifierChallenge = base64Url(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input.codeVerifier)),
  );
  if (verifierChallenge !== row.codeChallenge) {
    throw new OAuthError("invalid_grant", "code_verifier does not match the code_challenge.");
  }

  const consumed = await db.prepare(
    `UPDATE mcp_authorization_codes SET consumed_at = CURRENT_TIMESTAMP
     WHERE code_hash = ? AND consumed_at IS NULL`,
  ).bind(codeHash).run();
  if (!consumed.meta?.changes) {
    throw new OAuthError("invalid_grant", "The authorization code was already redeemed.");
  }

  const parsedScopes = JSON.parse(row.scopesJson) as unknown;
  const scopes = Array.isArray(parsedScopes)
    ? QUEUEPROOF_MCP_SCOPES.filter((scope) => parsedScopes.includes(scope))
    : ["queueproof:read" as const];
  const accessToken = randomToken("qpt", 32);
  const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_MS).toISOString();

  await db.batch([
    db.prepare(
      `INSERT INTO mcp_tokens
         (id, workspace_id, client_id, token_hash, audience, scopes_json, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      randomToken("mtk", 12),
      row.workspaceId,
      row.clientId,
      await sha256(accessToken),
      input.audience,
      JSON.stringify(scopes),
      expiresAt,
    ),
    // Bind the registration row to the consenting user's workspace so the connector
    // shows up in that workspace's client ledger with real handshake timestamps.
    db.prepare(
      `UPDATE mcp_clients
       SET workspace_id = ?, user_id = ?, scopes_json = ?, status = 'connected',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    ).bind(row.workspaceId, row.userId, JSON.stringify(scopes), row.clientId),
  ]);

  return {
    accessToken,
    expiresInSeconds: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
    scopes: scopes as QueueProofMcpScope[],
  };
}

/** RFC 8414 metadata for QueueProof as its own authorization server. */
export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    scopes_supported: [...QUEUEPROOF_MCP_SCOPES],
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    service_documentation: `${origin}/developer`,
  };
}
