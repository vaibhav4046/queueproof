import { describe, expect, it } from "vitest";
import {
  legacyOwnerSignInEnabled,
  normaliseSupabaseUrl,
  queueProofAuthMode,
  supabaseConfig,
  supabaseWebEnabled,
} from "../lib/server/supabase";

const complete = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_value_123456789",
};

describe("Supabase configuration", () => {
  it("normalises a configured project origin and never accepts token-controlled URL parts", () => {
    expect(normaliseSupabaseUrl("https://Project.Supabase.co/"))
      .toBe("https://project.supabase.co");
    expect(normaliseSupabaseUrl("https://user:pass@project.supabase.co")).toBe("");
    expect(supabaseConfig(complete)).toMatchObject({
      url: "https://project.supabase.co",
      issuer: "https://project.supabase.co/auth/v1",
      jwksUrl: "https://project.supabase.co/auth/v1/.well-known/jwks.json",
    });
  });

  it("defaults a complete non-production configuration to hybrid migration mode", () => {
    expect(queueProofAuthMode(complete)).toBe("hybrid");
    expect(supabaseWebEnabled(complete)).toBe(true);
    expect(legacyOwnerSignInEnabled(complete)).toBe(true);
  });

  it("defaults a complete production installation to Supabase-only web identity", () => {
    const production = { ...complete, VERCEL_ENV: "production" };
    expect(queueProofAuthMode(production)).toBe("supabase");
    expect(supabaseWebEnabled(production)).toBe(true);
    expect(legacyOwnerSignInEnabled(production)).toBe(false);
  });

  it("accepts the server-scoped Marketplace pair without requiring NEXT_PUBLIC aliases", () => {
    const marketplace = {
      SUPABASE_URL: complete.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY: complete.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    };
    expect(supabaseConfig(marketplace)).toMatchObject({
      url: "https://project.supabase.co",
      publishableKey: complete.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    });
    expect(supabaseWebEnabled(marketplace)).toBe(true);
  });

  it("keeps the older server-only anon-key alias as a bounded compatibility fallback", () => {
    expect(supabaseConfig({
      SUPABASE_URL: complete.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_ANON_KEY: "legacy-anon-key-value-for-tests",
    })).toMatchObject({ publishableKey: "legacy-anon-key-value-for-tests" });
  });

  it("rejects partial configuration and honors a Supabase-only legacy cutoff", () => {
    expect(supabaseConfig({ NEXT_PUBLIC_SUPABASE_URL: complete.NEXT_PUBLIC_SUPABASE_URL })).toBeNull();
    const supabaseOnly = { ...complete, QUEUEPROOF_AUTH_MODE: "supabase" };
    expect(supabaseWebEnabled(supabaseOnly)).toBe(true);
    expect(legacyOwnerSignInEnabled(supabaseOnly)).toBe(false);
  });
});
