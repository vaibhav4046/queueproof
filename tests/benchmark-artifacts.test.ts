import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { GET as readLab } from "../app/api/lab/route";
import { POST as publishArtifact } from "../app/api/lab/artifacts/route";
import { requireDb } from "../lib/server/runtime";
import { createId, ensureCoreSchema } from "../lib/server/store";

const workspaceId = createId("ws_benchmark_artifact");
const releaseSha = "a".repeat(40);
const publishToken = "benchmark-publisher-token-that-is-long-enough";

const artifact = {
  status: "measured",
  generatedAt: "2026-08-05T12:00:00.000Z",
  grader: "grounded-grader-v3",
  target: "https://queueproof.test",
  requestedMode: "auto",
  release: { commitSha: releaseSha, commitRef: "main", deploymentUrl: "queueproof.test" },
  releaseVerified: true,
  cases: 1,
  passed: 1,
  quality: {
    relevancePrecision: 1,
    irrelevantClaimRate: 0,
    relevanceRequirementPasses: 1,
    zeroIrrelevantClaims: true,
  },
  rows: [{
    id: "case-1",
    apiOk: true,
    pass: true,
    mode: "fast",
    modeHonored: true,
    relevancePass: true,
    relevancePrecision: 1,
    irrelevantClaimRate: 0,
    relevantClaimCount: 1,
    irrelevantClaims: [],
  }],
};

function request(input: unknown, token = publishToken) {
  return new Request("http://queueproof.test/api/lab/artifacts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-queueproof-benchmark-token": token,
    },
    body: JSON.stringify(input),
  });
}

describe("release-bound benchmark artifacts", () => {
  beforeAll(async () => {
    await ensureCoreSchema();
    await requireDb().batch([
      requireDb().prepare("INSERT INTO users (id, email, display_name) VALUES (?, ?, ?)")
        .bind("user:public-access", "public-benchmark@example.invalid", "Public benchmark"),
      requireDb().prepare("INSERT INTO workspaces (id, slug, name) VALUES (?, ?, ?)")
        .bind(workspaceId, `benchmark-${workspaceId.slice(-8)}`, "Benchmark workspace"),
      requireDb().prepare(
        "INSERT INTO workspace_members (id, workspace_id, user_id, role) VALUES (?, ?, ?, 'member')",
      ).bind(createId("member"), workspaceId, "user:public-access"),
    ]);
  });

  afterEach(() => vi.unstubAllEnvs());

  function configure(sha = releaseSha) {
    vi.stubEnv("QUEUEPROOF_BENCHMARK_TOKEN", publishToken);
    vi.stubEnv("QUEUEPROOF_RELEASE_SHA", sha);
    vi.stubEnv("QUEUEPROOF_RELEASE_REF", "main");
    vi.stubEnv("QUEUEPROOF_PUBLIC_ACCESS", "true");
    vi.stubEnv("QUEUEPROOF_PUBLIC_WORKSPACE_ID", workspaceId);
    vi.stubEnv("QUEUEPROOF_ALLOW_LOCAL_IDENTITY", "false");
    vi.stubEnv("QUEUEPROOF_TRUSTED_IDENTITY_PROXY", "");
    vi.stubEnv("QUEUEPROOF_ENCRYPTION_KEY", "");
  }

  it("hides the publisher when the separate operator credential is wrong", async () => {
    configure();
    const response = await publishArtifact(request({ kind: "auto", artifact }, "wrong-token"));
    expect(response.status).toBe(404);
  });

  it("rejects a valid artifact measured against another release", async () => {
    configure();
    const response = await publishArtifact(request({
      kind: "auto",
      artifact: { ...artifact, release: { ...artifact.release, commitSha: "b".repeat(40) } },
    }));
    expect(response.status).toBe(409);
  });

  it("rejects a live artifact with no measured rows", async () => {
    configure();
    const response = await publishArtifact(request({
      kind: "auto",
      artifact: { ...artifact, cases: 0, rows: [] },
    }));
    expect(response.status).toBe(400);
  });

  it("rejects a v3 artifact with incomplete relevance receipts", async () => {
    configure();
    const incomplete = {
      ...artifact,
      quality: undefined,
      rows: [{ id: "case-1", apiOk: true, pass: true, mode: "fast", modeHonored: true }],
    };
    const response = await publishArtifact(request({ kind: "auto", artifact: incomplete }));
    expect(response.status).toBe(400);
  });

  it("upserts the strict artifact and serves it as current durable evidence", async () => {
    configure();
    const published = await publishArtifact(request({ kind: "auto", artifact }));
    expect(published.status).toBe(200);
    expect(await published.json()).toMatchObject({ ok: true, kind: "auto", releaseSha });

    const stored = await requireDb().prepare(
      "SELECT kind, release_sha AS releaseSha FROM benchmark_artifacts WHERE workspace_id = ?",
    ).bind(workspaceId).first<{ kind: string; releaseSha: string }>();
    expect(stored).toEqual({ kind: "auto", releaseSha });

    const pdfArtifact = {
      ...artifact,
      requestedMode: undefined,
      quality: { ...artifact.quality, scope: "document-only" },
      crossSource: {
        pass: true,
        relevancePass: true,
        relevancePrecision: 1,
        irrelevantClaimRate: 0,
        irrelevantClaims: [],
        providers: ["document", "github", "slack"],
        connectorProviderPass: true,
        citationPass: true,
      },
      document: { filename: "proof.pdf", pages: 346, sha256: "reviewed-pdf-sha" },
    };
    expect((await publishArtifact(request({ kind: "pdf", artifact: pdfArtifact }))).status).toBe(200);

    const response = await readLab();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.results.live).toMatchObject({
      storage: "durable",
      grader: "grounded-grader-v3",
      quality: {
        relevancePrecision: 1,
        irrelevantClaimRate: 0,
        zeroIrrelevantClaims: true,
      },
      rows: [{
        relevancePrecision: 1,
        irrelevantClaimRate: 0,
      }],
      release: { commitSha: releaseSha },
    });
    expect(body.results.pdf).toMatchObject({
      storage: "durable",
      quality: {
        scope: "document-only",
        relevancePrecision: 1,
        irrelevantClaimRate: 0,
        zeroIrrelevantClaims: true,
      },
      crossSource: {
        pass: true,
        relevancePass: true,
        relevancePrecision: 1,
        irrelevantClaimRate: 0,
      },
    });
    expect(JSON.stringify(body.results.pdf)).not.toContain("irrelevantClaims");
    expect(body.results.currentRelease.commitSha).toBe(releaseSha);
  });

  it("does not let an older artifact roll back a newer measurement", async () => {
    configure();
    const newer = { ...artifact, generatedAt: "2026-08-05T14:00:00.000Z" };
    expect((await publishArtifact(request({ kind: "auto", artifact: newer }))).status).toBe(200);
    const older = { ...artifact, generatedAt: "2026-08-05T13:00:00.000Z" };
    expect((await publishArtifact(request({ kind: "auto", artifact: older }))).status).toBe(409);
    const stored = await requireDb().prepare(
      `SELECT generated_at AS generatedAt FROM benchmark_artifacts
       WHERE workspace_id = ? AND kind = 'auto' AND release_sha = ?`,
    ).bind(workspaceId, releaseSha).first<{ generatedAt: string }>();
    expect(stored?.generatedAt).toBe(newer.generatedAt);
  });

  it("never presents a bundled artifact from another SHA as current measurement", async () => {
    const unmeasuredSha = "c".repeat(40);
    configure(unmeasuredSha);
    const response = await readLab();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.results.currentRelease.commitSha).toBe(unmeasuredSha);
    expect(body.results.live).toMatchObject({
      status: "awaiting_current_release_measurement",
      storage: "none",
      cases: 0,
    });
    expect(body.results.modeComparison.comparable).toBe(false);
    expect(body.results.pdf).toMatchObject({
      status: "awaiting_current_release_measurement",
      storage: "none",
      cases: null,
    });
  });
});
