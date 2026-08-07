import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE } from "../lib/server/identity";
import { proxy } from "../proxy";

function configureSupabase() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test_value_123456789");
  vi.stubEnv("QUEUEPROOF_AUTH_MODE", "hybrid");
}

describe("Supabase session proxy", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("keeps branded QueueProof routes local when no session needs refresh", async () => {
    configureSupabase();
    const response = await proxy(new NextRequest("https://queueproof.vercel.app/sign-in"));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("clears the legacy owner cookie during a Supabase logout", async () => {
    configureSupabase();
    const response = await proxy(new NextRequest("https://queueproof.vercel.app/auth/logout"));
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${SESSION_COOKIE}=`);
    expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970/i);
  });
});
