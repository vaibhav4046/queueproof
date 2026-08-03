export type RuntimeConfigIssue = { key: string; message: string };

/** Validate deployment invariants without ever including a configured value in errors. */
export function validateRuntimeConfig(
  env: Record<string, unknown>,
  options: { production?: boolean } = {},
): RuntimeConfigIssue[] {
  const production = options.production ?? env.NODE_ENV === "production";
  const value = (key: string) => typeof env[key] === "string" ? String(env[key]).trim() : "";
  const issues: RuntimeConfigIssue[] = [];
  const encryptionKey = value("QUEUEPROOF_ENCRYPTION_KEY");
  const tursoUrl = value("TURSO_DATABASE_URL");
  const tursoToken = value("TURSO_AUTH_TOKEN");
  const publicAccess = value("QUEUEPROOF_PUBLIC_ACCESS");

  if (encryptionKey && encryptionKey.length < 32) {
    issues.push({ key: "QUEUEPROOF_ENCRYPTION_KEY", message: "must contain at least 32 characters" });
  }
  if (Boolean(tursoUrl) !== Boolean(tursoToken)) {
    issues.push({ key: "TURSO_DATABASE_URL/TURSO_AUTH_TOKEN", message: "must be configured as a complete pair" });
  }
  if (publicAccess && !["true", "false"].includes(publicAccess)) {
    issues.push({ key: "QUEUEPROOF_PUBLIC_ACCESS", message: "must be exactly true or false" });
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
