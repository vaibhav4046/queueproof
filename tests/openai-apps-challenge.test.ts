import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "../app/.well-known/openai-apps-challenge/route";

afterEach(() => vi.unstubAllEnvs());

describe("OpenAI plugin domain challenge", () => {
  it("stays unavailable until the publisher receives a portal token", async () => {
    vi.stubEnv("OPENAI_APPS_CHALLENGE", "");
    const response = await GET();

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe("Not configured");
  });

  it("returns only the exact configured token as plain text", async () => {
    vi.stubEnv("OPENAI_APPS_CHALLENGE", "openai-domain-proof_2026.08.06");
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe("openai-domain-proof_2026.08.06");
  });

  it("rejects unsafe multi-line configuration", async () => {
    vi.stubEnv("OPENAI_APPS_CHALLENGE", "first-line\nsecond-line");
    const response = await GET();

    expect(response.status).toBe(503);
    expect(await response.text()).toBe("Invalid configuration");
  });
});
