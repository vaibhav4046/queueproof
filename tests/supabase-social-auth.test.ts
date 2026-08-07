import { describe, expect, it } from "vitest";
import {
  enabledSupabaseSocialProviders,
  type SupabaseConfig,
} from "../lib/server/supabase";
import { queueProofAuthErrorMessage } from "../lib/supabase/auth-errors";
import { QUEUEPROOF_SOCIAL_PROVIDERS } from "../lib/supabase/social-providers";

const config: SupabaseConfig = {
  url: "https://queueproof-test.supabase.co",
  publishableKey: "sb_publishable_012345678901234567890123456789",
  issuer: "https://queueproof-test.supabase.co/auth/v1",
  jwksUrl: "https://queueproof-test.supabase.co/auth/v1/.well-known/jwks.json",
  authorizationServer: "https://queueproof-test.supabase.co/auth/v1",
};

describe("Supabase social sign-in boundary", () => {
  it("allow-lists identity providers and never treats Linear or legacy Slack as login", () => {
    expect([...QUEUEPROOF_SOCIAL_PROVIDERS]).toEqual([
      "google",
      "github",
      "slack_oidc",
    ]);
    expect([...QUEUEPROOF_SOCIAL_PROVIDERS]).not.toContain("linear");
    expect([...QUEUEPROOF_SOCIAL_PROVIDERS]).not.toContain("slack");
  });

  it("renders only allow-listed providers Supabase reports enabled", async () => {
    let requestedUrl = "";
    let requestedInit: RequestInit | undefined;
    const request = async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> => {
      requestedUrl = String(input);
      requestedInit = init;
      return new Response(
        JSON.stringify({
          external: {
            google: true,
            github: false,
            slack_oidc: true,
            slack: true,
            linear: true,
          },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    };

    await expect(
      enabledSupabaseSocialProviders(config, request),
    ).resolves.toEqual(["google", "slack_oidc"]);
    expect(requestedUrl).toBe(
      "https://queueproof-test.supabase.co/auth/v1/settings",
    );
    expect(requestedInit?.cache).toBe("no-store");
    expect(new Headers(requestedInit?.headers).get("apikey")).toBe(
      config.publishableKey,
    );
  });

  it.each([
    [
      "non-2xx settings",
      async () => new Response("unavailable", { status: 503 }),
    ],
    ["malformed settings", async () => new Response("{", { status: 200 })],
    [
      "network failure",
      async () => {
        throw new Error("offline");
      },
    ],
  ])("fails closed on %s", async (_name, request) => {
    await expect(
      enabledSupabaseSocialProviders(config, request as typeof fetch),
    ).resolves.toEqual([]);
  });

  it("maps only QueueProof-owned callback codes to non-reflected copy", () => {
    const message = queueProofAuthErrorMessage("callback");
    expect(message).toContain("could not complete sign-in");
    expect(message).toContain("No source was connected or changed");
    expect(queueProofAuthErrorMessage(["callback", "ignored"])).toBe(message);
    expect(queueProofAuthErrorMessage("access_token=do-not-reflect")).toBe("");
    expect(queueProofAuthErrorMessage(undefined)).toBe("");
  });
});
