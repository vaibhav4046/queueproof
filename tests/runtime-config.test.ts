import { describe, expect, it } from "vitest";
import { assertRuntimeConfig, validateRuntimeConfig } from "../lib/server/runtime-config";

const validProduction = {
  NODE_ENV: "production",
  QUEUEPROOF_ENCRYPTION_KEY: "x".repeat(32),
  TURSO_DATABASE_URL: "libsql://queueproof.example.invalid",
  TURSO_AUTH_TOKEN: "not-a-real-token-for-test-purposes",
  QUEUEPROOF_PUBLIC_ACCESS: "true",
  QUEUEPROOF_TEST_MODE: "false",
  QUEUEPROOF_LIVE_TEST: "false",
  QUEUEPROOF_ALLOW_LOCAL_IDENTITY: "false",
};

describe("runtime configuration", () => {
  it("accepts a complete production boundary", () => {
    expect(validateRuntimeConfig(validProduction, { production: true })).toEqual([]);
  });

  it("fails closed on missing durability, weak cryptography, and fixture mode", () => {
    const issues = validateRuntimeConfig({
      NODE_ENV: "production",
      QUEUEPROOF_ENCRYPTION_KEY: "short",
      TURSO_DATABASE_URL: "libsql://present-without-token.invalid",
      QUEUEPROOF_TEST_MODE: "true",
    }, { production: true });
    expect(issues.map((issue) => issue.key)).toEqual(expect.arrayContaining([
      "QUEUEPROOF_ENCRYPTION_KEY",
      "TURSO_DATABASE_URL/TURSO_AUTH_TOKEN",
      "QUEUEPROOF_TEST_MODE",
    ]));
    expect(() => assertRuntimeConfig({ NODE_ENV: "production" }, { production: true })).toThrow(
      /runtime configuration is invalid/i,
    );
  });

  it("rejects ambiguous public-access values", () => {
    expect(validateRuntimeConfig({ QUEUEPROOF_PUBLIC_ACCESS: "yes" }))
      .toContainEqual(expect.objectContaining({ key: "QUEUEPROOF_PUBLIC_ACCESS" }));
  });
});
