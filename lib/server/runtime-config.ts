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
  const supabaseUrl = value("NEXT_PUBLIC_SUPABASE_URL") || value("SUPABASE_URL");
  const supabasePublishableKey = value("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ||
    value("SUPABASE_PUBLISHABLE_KEY") || value("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const anySupabase = Boolean(supabaseUrl || supabasePublishableKey);
  const completeSupabase = Boolean(supabaseUrl && supabasePublishableKey);
  const validAuthMode = ["legacy", "hybrid", "supabase"].includes(authMode) ? authMode : "";
  const effectiveAuthMode = validAuthMode || (completeSupabase
    ? (production ? "supabase" : "hybrid")
    : "legacy");
  const effectiveLegacyOwnerSignIn = legacyOwnerSignIn === "true" || legacyOwnerSignIn === "false"
    ? legacyOwnerSignIn
    : (completeSupabase && production ? "false" : effectiveAuthMode === "supabase" ? "false" : "true");

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
  if (authMode && !["legacy", "hybrid", "supabase"].includes(authMode)) {
    issues.push({ key: "QUEUEPROOF_AUTH_MODE", message: "must be legacy, hybrid, or supabase" });
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
  if (mcpAuthMode && !["opaque", "hybrid", "supabase"].includes(mcpAuthMode)) {
    issues.push({ key: "QUEUEPROOF_MCP_AUTH_MODE", message: "must be opaque, hybrid, or supabase" });
  }
  if (anySupabase && !completeSupabase) {
    issues.push({ key: "SUPABASE_PUBLIC_CONFIG", message: "must provide a URL and publishable key together" });
  }
  if (supabaseUrl) {
    try {
      const url = new URL(supabaseUrl);
      const local = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
      if ((url.protocol !== "https:" && !(local && !production && url.protocol === "http:")) ||
          url.username || url.password || url.search || url.hash || url.pathname !== "/") {
        throw new Error("invalid Supabase URL");
      }
    } catch {
      issues.push({ key: "NEXT_PUBLIC_SUPABASE_URL", message: "must be a trusted HTTPS project origin" });
    }
  }
  if (supabasePublishableKey && supabasePublishableKey.length < 20) {
    issues.push({ key: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", message: "is not a valid publishable key" });
  }
  if ((authMode === "hybrid" || authMode === "supabase") && !completeSupabase) {
    issues.push({ key: "QUEUEPROOF_AUTH_MODE", message: "requires the complete Supabase public configuration" });
  }
  if (mcpAuthMode === "hybrid" || mcpAuthMode === "supabase") {
    if (!completeSupabase) {
      issues.push({ key: "QUEUEPROOF_MCP_AUTH_MODE", message: "requires the complete Supabase public configuration" });
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
    if (completeSupabase && effectiveAuthMode !== "supabase") {
      issues.push({
        key: "QUEUEPROOF_AUTH_MODE",
        message: "must resolve to supabase in production when Supabase is configured",
      });
    }
    if (completeSupabase && effectiveLegacyOwnerSignIn !== "false") {
      issues.push({
        key: "QUEUEPROOF_LEGACY_OWNER_SIGNIN",
        message: "must resolve to false in production when Supabase is configured",
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
