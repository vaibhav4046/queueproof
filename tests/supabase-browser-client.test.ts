import { beforeEach, describe, expect, it, vi } from "vitest";

const { createBrowserClient } = vi.hoisted(() => ({
  createBrowserClient: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({ createBrowserClient }));

import { createQueueProofBrowserClient } from "../lib/supabase/client";

describe("Supabase browser client", () => {
  beforeEach(() => {
    createBrowserClient.mockReset();
  });

  it("uses the server-resolved public Marketplace pair and reuses the matching client", () => {
    const client = { auth: { signInWithOtp: vi.fn() } };
    createBrowserClient.mockReturnValue(client);
    const config = {
      url: "https://project.supabase.co",
      publishableKey: "sb_publishable_test_value_123456789",
    };

    expect(createQueueProofBrowserClient(config)).toBe(client);
    expect(createQueueProofBrowserClient(config)).toBe(client);
    expect(createBrowserClient).toHaveBeenCalledTimes(1);
    expect(createBrowserClient).toHaveBeenCalledWith(
      config.url,
      config.publishableKey,
      { auth: { flowType: "pkce" } },
    );
  });
});
