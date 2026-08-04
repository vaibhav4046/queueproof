import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "../app/api/health/live/route";

afterEach(() => vi.unstubAllEnvs());

describe("live release identity", () => {
  it("reports an explicit reviewed deployment SHA when Git metadata is absent", async () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "");
    vi.stubEnv("VERCEL_GIT_COMMIT_REF", "");
    vi.stubEnv("QUEUEPROOF_RELEASE_SHA", "reviewed-sha");
    vi.stubEnv("QUEUEPROOF_RELEASE_REF", "main");

    const body = await (await GET()).json();
    expect(body.release).toMatchObject({ commitSha: "reviewed-sha", commitRef: "main" });
  });

  it("prefers Vercel Git metadata when the deployment supplies it", async () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "git-sha");
    vi.stubEnv("VERCEL_GIT_COMMIT_REF", "rescue/premium-graph-release");
    vi.stubEnv("QUEUEPROOF_RELEASE_SHA", "manual-sha");
    vi.stubEnv("QUEUEPROOF_RELEASE_REF", "manual-ref");

    const body = await (await GET()).json();
    expect(body.release).toMatchObject({
      commitSha: "git-sha",
      commitRef: "rescue/premium-graph-release",
    });
  });
});
