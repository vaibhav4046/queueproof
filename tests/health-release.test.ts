import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "../app/api/health/live/route";

afterEach(() => vi.unstubAllEnvs());

describe("live release identity", () => {
  it("reports an explicit reviewed deployment SHA when Git metadata is absent", async () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "");
    vi.stubEnv("VERCEL_GIT_COMMIT_REF", "");
    vi.stubEnv("QUEUEPROOF_RELEASE_SHA", "reviewed-sha");
    vi.stubEnv("QUEUEPROOF_RELEASE_REF", "main");
    vi.stubEnv("VERCEL_TARGET_ENV", "production");
    vi.stubEnv("VERCEL_DEPLOYMENT_ID", "dpl_release_receipt");
    vi.stubEnv("VERCEL_URL", "queueproof-release.example.vercel.app");
    vi.stubEnv("QUEUEPROOF_DEPLOYMENT_TIMESTAMP", "2026-08-06T17:20:00.000Z");

    const body = await (await GET()).json();
    expect(body).toMatchObject({ status: "live", environment: "production" });
    expect(body.release).toMatchObject({
      commitSha: "reviewed-sha",
      commitRef: "main",
      target: "production",
      deploymentId: "dpl_release_receipt",
      deploymentUrl: "queueproof-release.example.vercel.app",
      deploymentTimestamp: "2026-08-06T17:20:00.000Z",
      benchmarkReceiptVersion: "grounded-grader-v3",
    });
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

  it("uses the immutable build stamp for Git-triggered deployments", async () => {
    vi.stubEnv("QUEUEPROOF_DEPLOYMENT_TIMESTAMP", "");
    vi.stubEnv("QUEUEPROOF_BUILD_TIMESTAMP", "2026-08-06T20:42:19.000Z");

    const body = await (await GET()).json();
    expect(body.release.deploymentTimestamp).toBe("2026-08-06T20:42:19.000Z");
  });

  it("keeps unavailable platform identity explicit instead of inventing it", async () => {
    vi.stubEnv("VERCEL_DEPLOYMENT_ID", "");
    vi.stubEnv("VERCEL_URL", "");
    vi.stubEnv("QUEUEPROOF_DEPLOYMENT_TIMESTAMP", "");
    vi.stubEnv("QUEUEPROOF_BUILD_TIMESTAMP", "");

    const body = await (await GET()).json();
    expect(body.release).toMatchObject({
      deploymentId: null,
      deploymentUrl: null,
      deploymentTimestamp: null,
      benchmarkReceiptVersion: "grounded-grader-v3",
    });
  });

  it("keeps the production deploy path strict and self-verifying", () => {
    const script = readFileSync(new URL("../scripts/deploy-prod.mjs", import.meta.url), "utf8");
    const gate = readFileSync(new URL("../scripts/release-gate.mjs", import.meta.url), "utf8");

    expect(script).not.toContain("--allow-dirty");
    expect(script).toContain('"pnpm", ["dlx", "vercel@58.7.1"');
    expect(script).toContain("VERCEL_PROJECT_ID");
    expect(script).toContain("VERCEL_ORG_ID");
    expect(script).toContain('"--format", "json"');
    expect(script.match(/"--build-env"/g)).toHaveLength(3);
    expect(script.match(/"--env"/g)).toHaveLength(3);
    expect(script).toContain("payload.deployment ?? payload");
    expect(script).toContain("/api/health/live");
    expect(script).toContain("/api/lab");
    expect(script).toContain('benchmarkReceiptVersion !== "grounded-grader-v3"');
    expect(gate).toContain('health.status, "live"');
    expect(gate).toContain('typeof health.release.commitRef === "string"');
  });
});
