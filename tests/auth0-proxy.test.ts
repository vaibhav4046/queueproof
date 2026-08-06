import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE } from "../lib/server/identity";
import { proxy } from "../proxy";

function configureAuth0() {
  vi.stubEnv("AUTH0_DOMAIN", "tenant.example.auth0.com");
  vi.stubEnv("AUTH0_CLIENT_ID", "queueproof-web");
  vi.stubEnv("AUTH0_CLIENT_SECRET", "client-secret");
  vi.stubEnv("AUTH0_SECRET", "a".repeat(64));
  vi.stubEnv("QUEUEPROOF_AUTH_MODE", "hybrid");
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({
    issuer: "https://tenant.example.auth0.com/",
    authorization_endpoint: "https://tenant.example.auth0.com/authorize",
    token_endpoint: "https://tenant.example.auth0.com/oauth/token",
    userinfo_endpoint: "https://tenant.example.auth0.com/userinfo",
    jwks_uri: "https://tenant.example.auth0.com/.well-known/jwks.json",
    end_session_endpoint: "https://tenant.example.auth0.com/oidc/logout",
    response_types_supported: ["code"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
    code_challenge_methods_supported: ["S256"],
  })));
}

describe("Auth0 routing proxy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sends sign-in through the pinned issuer and canonical callback", async () => {
    configureAuth0();
    const response = await proxy(new NextRequest("https://queueproof.vercel.app/auth/login"));
    const location = new URL(response.headers.get("location") ?? "");

    expect(response.status).toBe(307);
    expect(location.origin).toBe("https://tenant.example.auth0.com");
    expect(location.pathname).toBe("/authorize");
    expect(location.searchParams.get("client_id")).toBe("queueproof-web");
    expect(location.searchParams.get("redirect_uri"))
      .toBe("https://queueproof.vercel.app/auth/callback");
    expect(location.searchParams.get("response_type")).toBe("code");
  });

  it("clears the legacy owner cookie during an Auth0 logout", async () => {
    configureAuth0();
    const response = await proxy(new NextRequest("https://queueproof.vercel.app/auth/logout"));
    const cookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(307);
    expect(cookie).toContain(`${SESSION_COOKIE}=`);
    expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970/i);
  });
});
