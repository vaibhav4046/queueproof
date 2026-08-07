export type RuntimeConfigIssue = { key: string; message: string };

const CANONICAL_MCP_RESOURCE = "https://queueproof.vercel.app/mcp";

/** Validate deployment invariants without ever including a configured value in errors. */
export function validateRuntimeConfig(
  env: Record<string, unknown>,
  options: { production?: boolean } = {},
): RuntimeConfigIssue[] {
  const value = (key: string) => typeof env[key] === "string" ? String(env[key]).trim() : "";
  const production = options.production ?? (
    value("NODE_ENV") === "production" || value("VERCEL_ENV") === "production"
  );
  const issues: RuntimeConfigIssue[] = [];
  const encryptionKey = value("QUEUEPROOF_ENCRYPTION_KEY");
  const tursoUrl = value("TURSO_DATABASE_URL");
  const tursoToken = value("TURSO_AUTH_TOKEN");
  const publicAccess = value("QUEUEPROOF_PUBLIC_ACCESS");
  const authMode = value("QUEUEPROOF_AUTH_MODE");
  const legacyOwnerSignIn = value("QUEUEPROOF_LEGACY_OWNER_SIGNIN");
  const mcpAuthMode = value("QUEUEPROOF_MCP_AUTH_MODE");
  const trustedIdentityProxy = value("QUEUEPROOF_TRUSTED_IDENTITY_PROXY");
  const onVercel = value("VERCEL") === "1" || Boolean(value("VERCEL_ENV"));
  const linearApiKey = value("LINEAR_API_KEY");
  const linearExecutionWorkspaceId = value("QUEUEPROOF_LINEAR_EXECUTION_WORKSPACE_ID");
  const auth0Keys = ["AUTH0_DOMAIN", "AUTH0_CLIENT_ID", "AUTH0_CLIENT_SECRET", "AUTH0_SECRET"];
  const auth0Values = auth0Keys.map(value);
  const anyAuth0 = auth0Values.some(Boolean);
  const completeAuth0 = auth0Values.every(Boolean);
  const validAuthMode = ["legacy", "hybrid", "auth0"].includes(authMode) ? authMode : "";
  const effectiveAuthMode = validAuthMode || (completeAuth0
    ? (production ? "auth0" : "hybrid")
    : "legacy");
  const effectiveLegacyOwnerSignIn = legacyOwnerSignIn === "true" || legacyOwnerSignIn === "false"
    ? legacyOwnerSignIn
    : (completeAuth0 && production ? "false" : effectiveAuthMode === "auth0" ? "false" : "true");

  if (encryptionKey && encryptionKey.length < 32) {
    issues.push({ key: "QUEUEPROOF_ENCRYPTION_KEY", message: "must contain at least 32 characters" });
  }
  if (Boolean(tursoUrl) !== Boolean(tursoToken)) {
    issues.push({ key: "TURSO_DATABASE_URL/TURSO_AUTH_TOKEN", message: "must be configured as a complete pair" });
  }
  if (Boolean(linearApiKey) !== Boolean(linearExecutionWorkspaceId)) {
    issues.push({
      key: "LINEAR_API_KEY/QUEUEPROOF_LINEAR_EXECUTION_WORKSPACE_ID",
      message: "must be configured as an explicit workspace-bound pair",
    });
  }
  if (publicAccess && !["true", "false"].includes(publicAccess)) {
    issues.push({ key: "QUEUEPROOF_PUBLIC_ACCESS", message: "must be exactly true or false" });
  }
  if (publicAccess === "true" && !value("QUEUEPROOF_PUBLIC_WORKSPACE_ID")) {
    issues.push({
      key: "QUEUEPROOF_PUBLIC_WORKSPACE_ID",
      message: "is required when public access is enabled",
    });
  }
  if (authMode && !["legacy", "hybrid", "auth0"].includes(authMode)) {
    issues.push({ key: "QUEUEPROOF_AUTH_MODE", message: "must be legacy, hybrid, or auth0" });
  }
  if (legacyOwnerSignIn && !["true", "false"].includes(legacyOwnerSignIn)) {
    issues.push({ key: "QUEUEPROOF_LEGACY_OWNER_SIGNIN", message: "must be exactly true or false" });
  }
  if (trustedIdentityProxy && trustedIdentityProxy !== "openai-sites") {
    issues.push({
      key: "QUEUEPROOF_TRUSTED_IDENTITY_PROXY",
      message: "must be empty or the supported upstream gateway",
    });
  }
  if (trustedIdentityProxy === "openai-sites" && onVercel) {
    issues.push({
      key: "QUEUEPROOF_TRUSTED_IDENTITY_PROXY",
      message: "cannot trust upstream identity headers on a direct Vercel deployment",
    });
  }
  if (mcpAuthMode && !["opaque", "hybrid", "auth0"].includes(mcpAuthMode)) {
    issues.push({ key: "QUEUEPROOF_MCP_AUTH_MODE", message: "must be opaque, hybrid, or auth0" });
  }
  if (anyAuth0 && !completeAuth0) {
    issues.push({ key: "AUTH0_*", message: "must be configured as a complete four-value set" });
  }
  if (value("AUTH0_SECRET") && !/^[a-f0-9]{64}$/i.test(value("AUTH0_SECRET"))) {
    issues.push({ key: "AUTH0_SECRET", message: "must be a 32-byte hex value" });
  }
  if (completeAuth0 && !/^[a-z0-9.-]+$/i.test(value("AUTH0_DOMAIN").replace(/^https?:\/\//i, "").replace(/\/+$/, ""))) {
    issues.push({ key: "AUTH0_DOMAIN", message: "must be an Auth0 hostname" });
  }
  if ((authMode === "hybrid" || authMode === "auth0") && !completeAuth0) {
    issues.push({ key: "QUEUEPROOF_AUTH_MODE", message: "requires the complete AUTH0_* configuration" });
  }
  if (mcpAuthMode === "hybrid" || mcpAuthMode === "auth0") {
    if (!completeAuth0) {
      issues.push({ key: "QUEUEPROOF_MCP_AUTH_MODE", message: "requires the complete AUTH0_* configuration" });
    }
    try {
      const resource = new URL(value("QUEUEPROOF_MCP_RESOURCE"));
      if (resource.protocol !== "https:" || resource.pathname !== "/mcp" || resource.search || resource.hash) {
        throw new Error("invalid resource");
      }
      if (production && resource.toString() !== CANONICAL_MCP_RESOURCE) {
        throw new Error("non-canonical production resource");
      }
    } catch {
      issues.push({ key: "QUEUEPROOF_MCP_RESOURCE", message: "must be the canonical HTTPS /mcp URL" });
    }
  }
  if (production) {
    if (!encryptionKey) {
      issues.push({ key: "QUEUEPROOF_ENCRYPTION_KEY", message: "is required in production" });
    }
    if (!tursoUrl || !tursoToken) {
      issues.push({ key: "TURSO_DATABASE_URL/TURSO_AUTH_TOKEN", message: "durable storage is required in production" });
    }
    if (value("QUEUEPROOF_TEST_MODE") === "true" || value("QUEUEPROOF_LIVE_TEST") === "true") {
      issues.push({ key: "QUEUEPROOF_TEST_MODE", message: "fixture modes are forbidden in production" });
    }
    if (value("QUEUEPROOF_ALLOW_LOCAL_IDENTITY") === "true") {
      issues.push({ key: "QUEUEPROOF_ALLOW_LOCAL_IDENTITY", message: "local identity is forbidden in production" });
    }
    if (completeAuth0 && effectiveAuthMode !== "auth0") {
      issues.push({
        key: "QUEUEPROOF_AUTH_MODE",
        message: "must resolve to auth0 in production when Auth0 is configured",
      });
    }
    if (completeAuth0 && effectiveLegacyOwnerSignIn !== "false") {
      issues.push({
        key: "QUEUEPROOF_LEGACY_OWNER_SIGNIN",
        message: "must resolve to false in production when Auth0 is configured",
      });
    }
  }
  return issues;
}

export function assertRuntimeConfig(
  env: Record<string, unknown>,
  options: { production?: boolean } = {},
): void {
  const issues = validateRuntimeConfig(env, options);
  if (!issues.length) return;
  throw new Error(`QueueProof runtime configuration is invalid: ${issues.map((issue) => `${issue.key} ${issue.message}`).join("; ")}.`);
}
