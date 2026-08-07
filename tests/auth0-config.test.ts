import { describe, expect, it } from "vitest";
import {
  auth0Config,
  auth0WebEnabled,
  legacyOwnerSignInEnabled,
  normaliseAuth0Domain,
  queueProofAuthMode,
} from "../lib/server/auth0";

const complete = {
  AUTH0_DOMAIN: "tenant.example.auth0.com",
  AUTH0_CLIENT_ID: "client",
  AUTH0_CLIENT_SECRET: "client-secret",
  AUTH0_SECRET: "a".repeat(64),
};

describe("Auth0 configuration", () => {
  it("normalises the configured tenant and never derives it from a token", () => {
    expect(normaliseAuth0Domain("https://Tenant.Example.Auth0.com/"))
      .toBe("tenant.example.auth0.com");
    expect(auth0Config(complete)).toMatchObject({
      domain: "tenant.example.auth0.com",
      issuer: "https://tenant.example.auth0.com/",
    });
  });

  it("defaults a complete non-production configuration to a hybrid development rollout", () => {
    expect(queueProofAuthMode(complete)).toBe("hybrid");
    expect(auth0WebEnabled(complete)).toBe(true);
    expect(legacyOwnerSignInEnabled(complete)).toBe(true);
  });

  it("defaults a complete production installation to Auth0-only web identity", () => {
    const production = { ...complete, VERCEL_ENV: "production" };
    expect(queueProofAuthMode(production)).toBe("auth0");
    expect(auth0WebEnabled(production)).toBe(true);
    expect(legacyOwnerSignInEnabled(production)).toBe(false);
  });

  it("disables legacy owner authentication for a production Auth0 deployment", () => {
    expect(legacyOwnerSignInEnabled({
      ...complete,
      NODE_ENV: "production",
      QUEUEPROOF_AUTH_MODE: "hybrid",
      QUEUEPROOF_LEGACY_OWNER_SIGNIN: "true",
    })).toBe(false);
  });

  it("rejects partial configuration and honors an auth0-only legacy cutoff", () => {
    expect(auth0Config({ AUTH0_DOMAIN: complete.AUTH0_DOMAIN })).toBeNull();
    const auth0Only = { ...complete, QUEUEPROOF_AUTH_MODE: "auth0" };
    expect(auth0WebEnabled(auth0Only)).toBe(true);
    expect(legacyOwnerSignInEnabled(auth0Only)).toBe(false);
  });
});
