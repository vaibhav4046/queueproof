import { describe, expect, it } from "vitest";
import { assertRuntimeConfig, validateRuntimeConfig } from "../lib/server/runtime-config";

const validProduction = {
  NODE_ENV: "production",
  QUEUEPROOF_ENCRYPTION_KEY: "x".repeat(32),
  TURSO_DATABASE_URL: "libsql://queueproof.example.invalid",
  TURSO_AUTH_TOKEN: "not-a-real-token-for-test-purposes",
  QUEUEPROOF_PUBLIC_ACCESS: "true",
  QUEUEPROOF_PUBLIC_WORKSPACE_ID: "ws_public_test",
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

  it("requires an explicit workspace selector whenever public access is enabled", () => {
    expect(validateRuntimeConfig({ QUEUEPROOF_PUBLIC_ACCESS: "true" }))
      .toContainEqual(expect.objectContaining({ key: "QUEUEPROOF_PUBLIC_WORKSPACE_ID" }));
  });

  it("requires a workspace binding for the legacy deployment Linear credential", () => {
    expect(validateRuntimeConfig({ LINEAR_API_KEY: "lin_api_test" }))
      .toContainEqual(expect.objectContaining({
        key: "LINEAR_API_KEY/QUEUEPROOF_LINEAR_EXECUTION_WORKSPACE_ID",
      }));
    expect(validateRuntimeConfig({
      LINEAR_API_KEY: "lin_api_test",
      QUEUEPROOF_LINEAR_EXECUTION_WORKSPACE_ID: "ws_operator",
    })).toEqual([]);
  });

  it("fails closed on partial Supabase and OAuth MCP configuration", () => {
    const partial = validateRuntimeConfig({
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      QUEUEPROOF_AUTH_MODE: "hybrid",
      QUEUEPROOF_MCP_AUTH_MODE: "hybrid",
      QUEUEPROOF_MCP_RESOURCE: "http://queueproof.example/mcp",
    });
    expect(partial.map((issue) => issue.key)).toEqual(expect.arrayContaining([
      "SUPABASE_PUBLIC_CONFIG",
      "QUEUEPROOF_AUTH_MODE",
      "QUEUEPROOF_MCP_AUTH_MODE",
      "QUEUEPROOF_MCP_RESOURCE",
    ]));
  });

  it("accepts complete Supabase web auth and the canonical MCP resource boundary", () => {
    expect(validateRuntimeConfig({
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_value_123456789",
      QUEUEPROOF_AUTH_MODE: "hybrid",
      QUEUEPROOF_MCP_AUTH_MODE: "hybrid",
      QUEUEPROOF_MCP_RESOURCE: "https://queueproof.vercel.app/mcp",
    })).toEqual([]);
  });

  it("defaults complete production Supabase to Supabase-only and rejects legacy rollout modes", () => {
    const supabaseProduction = {
      ...validProduction,
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_value_123456789",
    };
    expect(validateRuntimeConfig(supabaseProduction, { production: true })).toEqual([]);
    const unsafeRollout = validateRuntimeConfig({
      ...supabaseProduction,
      QUEUEPROOF_AUTH_MODE: "hybrid",
      QUEUEPROOF_LEGACY_OWNER_SIGNIN: "true",
    }, { production: true });
    expect(unsafeRollout).toContainEqual(expect.objectContaining({ key: "QUEUEPROOF_AUTH_MODE" }));
    expect(unsafeRollout).toContainEqual(expect.objectContaining({
      key: "QUEUEPROOF_LEGACY_OWNER_SIGNIN",
    }));
    expect(validateRuntimeConfig({
      ...supabaseProduction,
      QUEUEPROOF_AUTH_MODE: "legacy",
      QUEUEPROOF_LEGACY_OWNER_SIGNIN: "false",
    }, { production: true })).toContainEqual(expect.objectContaining({
      key: "QUEUEPROOF_AUTH_MODE",
    }));
    expect(validateRuntimeConfig({
      ...supabaseProduction,
      QUEUEPROOF_AUTH_MODE: "supabase",
      QUEUEPROOF_LEGACY_OWNER_SIGNIN: "false",
    }, { production: true })).toEqual([]);
  });

  it("rejects the OpenAI Sites identity-header trust mode on Vercel", () => {
    const issues = validateRuntimeConfig({
      ...validProduction,
      VERCEL_ENV: "production",
      QUEUEPROOF_TRUSTED_IDENTITY_PROXY: "openai-sites",
    }, { production: true });
    expect(issues).toContainEqual(expect.objectContaining({
      key: "QUEUEPROOF_TRUSTED_IDENTITY_PROXY",
    }));
  });

  it("rejects a non-canonical OAuth resource in production", () => {
    const issues = validateRuntimeConfig({
      ...validProduction,
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_value_123456789",
      QUEUEPROOF_AUTH_MODE: "supabase",
      QUEUEPROOF_LEGACY_OWNER_SIGNIN: "false",
      QUEUEPROOF_MCP_AUTH_MODE: "hybrid",
      QUEUEPROOF_MCP_RESOURCE: "https://other.example/mcp",
    }, { production: true });
    expect(issues).toContainEqual(expect.objectContaining({ key: "QUEUEPROOF_MCP_RESOURCE" }));
  });
});
