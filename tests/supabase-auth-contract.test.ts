import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Supabase branded-auth contract", () => {
  it("keeps web auth passwordless and service-role free", () => {
    const server = read("lib/server/supabase.ts");
    const browser = read("lib/supabase/client.ts");
    const form = read("app/sign-in/SignInForm.tsx");
    expect(server).toContain("getClaims()");
    expect(form).toContain("signInWithOtp");
    expect(form).toContain("signInWithOAuth");
    expect(server).toContain("enabledSupabaseSocialProviders");
    expect(server).toContain('settings.external?.[provider] === true');
    expect(form).toContain("createQueueProofBrowserClient(supabase)");
    expect(browser).toContain("config?.publishableKey");
    expect(`${server}\n${browser}\n${form}`).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("binds OAuth tokens to the canonical MCP resource only", () => {
    const hook = read("supabase/migrations/20260807000000_queueproof_mcp_claims.sql");
    const verifier = read("lib/server/mcp-auth.ts");
    expect(hook).toContain("claims ? 'client_id'");
    expect(hook).toContain("https://queueproof.vercel.app/mcp");
    expect(verifier).toContain('audience: config.resource');
    expect(verifier).toContain("verified.payload.client_id");
    expect(verifier).not.toMatch(/payload\.(?:user_metadata|app_metadata)/);
  });
});
