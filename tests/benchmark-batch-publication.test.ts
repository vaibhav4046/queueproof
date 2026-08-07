import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { POST as publishBatch } from "../app/api/lab/artifacts/batch/route";
import { requireDb } from "../lib/server/runtime";
import { createId, ensureCoreSchema } from "../lib/server/store";
import { sha256 } from "../packages/security/src";

const workspaceId = createId("ws_benchmark_batch");
const beforeExpiry = new Date("2026-08-07T16:00:00.000Z");

const testToken = (suffix: string) => `test-${suffix}-${"operator-".repeat(6)}`;

function artifact(kind: "auto" | "fast" | "thinking" | "pdf", releaseSha: string) {
  const base = {
    generatedAt: "2026-08-07T15:30:00.000Z",
    grader: "grounded-grader-v3",
    target: "https://queueproof.test",
    release: { commitSha: releaseSha, commitRef: "main", deploymentUrl: "queueproof.test" },
    releaseVerified: true,
    cases: 1,
    passed: 1,
    rows: [{
      id: `${kind}-case`,
      apiOk: true,
      pass: true,
      mode: kind === "auto" ? "fast" : kind,
      relevancePass: true,
      relevancePrecision: 1,
      irrelevantClaimRate: 0,
      relevantClaimCount: 1,
      irrelevantClaims: [] as Array<Record<string, unknown>>,
    }],
    quality: {
      requiredFactAccuracy: 1,
      citationPrecision: 1,
      citationCompleteness: 1,
      unsupportedClaimRate: 0,
      relevancePrecision: 1,
      irrelevantClaimRate: 0,
      relevanceRequirementPasses: 1,
      zeroKnowinglyUnsupportedClaims: true,
      zeroIrrelevantClaims: true,
    },
  };
  if (kind === "pdf") {
    return {
      ...base,
      canaries: { beginning: true, middle: true, end: true },
      crossSource: {
        pass: true,
        providers: ["document", "github", "linear"],
        relevancePass: true,
        relevancePrecision: 1,
        irrelevantClaimRate: 0,
        irrelevantClaims: [],
      },
    };
  }
  return { ...base, status: "measured", requestedMode: kind, connectors: ["github", "linear", "slack"] };
}

const artifacts = (releaseSha: string) => ({
  auto: artifact("auto", releaseSha),
  fast: artifact("fast", releaseSha),
  thinking: artifact("thinking", releaseSha),
  pdf: artifact("pdf", releaseSha),
});

async function configure(releaseSha: string, token: string) {
  vi.stubEnv("QUEUEPROOF_RELEASE_SHA", releaseSha);
  vi.stubEnv("QUEUEPROOF_RELEASE_REF", "main");
  vi.stubEnv("QUEUEPROOF_PUBLIC_WORKSPACE_ID", workspaceId);
  vi.stubEnv("QUEUEPROOF_BENCHMARK_ONCE_TOKEN_HASH", await sha256(token));
  vi.stubEnv("VERCEL_ENV", "");
}

function request(body: unknown, token: string) {
  return new Request("http://queueproof.test/api/lab/artifacts/batch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-queueproof-benchmark-once": token,
    },
    body: JSON.stringify(body),
  });
}

describe("one-time atomic benchmark publication", () => {
  beforeAll(async () => {
    await ensureCoreSchema();
    await requireDb().batch([
      requireDb().prepare("INSERT INTO workspaces (id, slug, name) VALUES (?, ?, ?)")
        .bind(workspaceId, `benchmark-batch-${workspaceId.slice(-8)}`, "Benchmark batch workspace"),
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("hides wrong credentials without consuming the valid token", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(beforeExpiry);
    const releaseSha = "1".repeat(40);
    const token = testToken("wrong-credential");
    await configure(releaseSha, token);

    expect((await publishBatch(request({ artifacts: artifacts(releaseSha) }, "wrong-token-that-is-still-long-enough-000"))).status)
      .toBe(404);
    expect((await publishBatch(request({ artifacts: artifacts(releaseSha) }, token))).status).toBe(200);
  });

  it("hides the route after the hard expiry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-08T06:00:00.000Z"));
    const releaseSha = "2".repeat(40);
    const token = testToken("expired");
    await configure(releaseSha, token);

    expect((await publishBatch(request({ artifacts: artifacts(releaseSha) }, token))).status).toBe(404);
  });

  it("rejects previews and oversized bodies before publication", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(beforeExpiry);
    const releaseSha = "3".repeat(40);
    const token = testToken("preview-and-size");
    await configure(releaseSha, token);
    vi.stubEnv("VERCEL_ENV", "preview");
    expect((await publishBatch(request({ artifacts: artifacts(releaseSha) }, token))).status).toBe(404);

    vi.stubEnv("VERCEL_ENV", "");
    const oversized = new Request("http://queueproof.test/api/lab/artifacts/batch", {
      method: "POST",
      headers: {
        "x-queueproof-benchmark-once": token,
        "content-length": "2000001",
      },
      body: "{}",
    });
    expect((await publishBatch(oversized)).status).toBe(413);
  });

  it("requires exactly four perfect strict-v3 artifacts for the current release", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(beforeExpiry);
    const releaseSha = "4".repeat(40);
    const token = testToken("strict-v3");
    await configure(releaseSha, token);

    const missingPdf = artifacts(releaseSha) as Record<string, unknown>;
    delete missingPdf.pdf;
    expect((await publishBatch(request({ artifacts: missingPdf }, token))).status).toBe(400);

    const v2 = artifacts(releaseSha);
    v2.auto.grader = "grounded-grader-v2";
    expect((await publishBatch(request({ artifacts: v2 }, token))).status).toBe(400);

    const aggregateIrrelevant = artifacts(releaseSha);
    aggregateIrrelevant.fast.quality.relevancePrecision = 0.875;
    expect((await publishBatch(request({ artifacts: aggregateIrrelevant }, token))).status).toBe(400);

    const rowIrrelevant = artifacts(releaseSha);
    rowIrrelevant.fast.rows[0].relevancePass = false;
    rowIrrelevant.fast.rows[0].irrelevantClaims = [{ text: "Off-question claim" }];
    expect((await publishBatch(request({ artifacts: rowIrrelevant }, token))).status).toBe(400);

    const incompleteV3Row = artifacts(releaseSha);
    incompleteV3Row.fast.rows[0].relevantClaimCount = Number.NaN;
    expect((await publishBatch(request({ artifacts: incompleteV3Row }, token))).status).toBe(400);

    const anotherRelease = artifacts(releaseSha);
    anotherRelease.thinking.release.commitSha = "5".repeat(40);
    expect((await publishBatch(request({ artifacts: anotherRelease }, token))).status).toBe(409);

    // Validation failures occur before the token receipt transaction.
    expect((await publishBatch(request({ artifacts: artifacts(releaseSha) }, token))).status).toBe(200);
  });

  it("does not consume a token or partially write when a conflicting release row exists", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(beforeExpiry);
    const releaseSha = "6".repeat(40);
    const token = testToken("conflict");
    await configure(releaseSha, token);
    await requireDb().prepare(
      `INSERT INTO benchmark_artifacts
       (id, workspace_id, kind, release_sha, artifact_json, artifact_hash, generated_at)
       VALUES (?, ?, 'auto', ?, '{}', 'different-hash', ?)`,
    ).bind(createId("benchmark"), workspaceId, releaseSha, "2026-08-07T15:00:00.000Z").run();

    expect((await publishBatch(request({ artifacts: artifacts(releaseSha) }, token))).status).toBe(409);
    const tokenHash = await sha256(token);
    expect(await requireDb().prepare(
      "SELECT token_hash FROM benchmark_publication_tokens WHERE token_hash = ?",
    ).bind(tokenHash).first()).toBeNull();
    const stored = await requireDb().prepare(
      "SELECT kind FROM benchmark_artifacts WHERE workspace_id = ? AND release_sha = ?",
    ).bind(workspaceId, releaseSha).all<{ kind: string }>();
    expect(stored.results.map((row) => row.kind)).toEqual(["auto"]);
  });

  it("commits four artifacts, the consumed hash, and audit atomically, then retries identically", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(beforeExpiry);
    const releaseSha = "7".repeat(40);
    const token = testToken("atomic-success");
    await configure(releaseSha, token);
    const body = { artifacts: artifacts(releaseSha) };

    const first = await publishBatch(request(body, token));
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ ok: true, releaseSha, releaseRef: "main", idempotent: false });

    const stored = await requireDb().prepare(
      `SELECT kind, artifact_hash AS artifactHash FROM benchmark_artifacts
       WHERE workspace_id = ? AND release_sha = ? ORDER BY kind`,
    ).bind(workspaceId, releaseSha).all<{ kind: string; artifactHash: string }>();
    expect(stored.results.map((row) => row.kind)).toEqual(["auto", "fast", "pdf", "thinking"]);
    expect(stored.results.every((row) => /^[0-9a-f]{64}$/.test(row.artifactHash))).toBe(true);

    const consumed = await requireDb().prepare(
      `SELECT release_sha AS releaseSha, artifact_set_hash AS artifactSetHash
       FROM benchmark_publication_tokens WHERE token_hash = ?`,
    ).bind(await sha256(token)).first<{ releaseSha: string; artifactSetHash: string }>();
    expect(consumed?.releaseSha).toBe(releaseSha);
    expect(consumed?.artifactSetHash).toMatch(/^[0-9a-f]{64}$/);
    const audit = await requireDb().prepare(
      `SELECT operation, outcome FROM audit_events
       WHERE workspace_id = ? AND operation = 'benchmark.publish_batch' AND target_id LIKE ?`,
    ).bind(workspaceId, `${releaseSha}:%`).first<{ operation: string; outcome: string }>();
    expect(audit).toEqual({ operation: "benchmark.publish_batch", outcome: "success" });

    const retry = await publishBatch(request(body, token));
    expect(retry.status).toBe(200);
    expect(await retry.json()).toMatchObject({ ok: true, releaseSha, idempotent: true });

    const changed = artifacts(releaseSha);
    changed.auto.generatedAt = "2026-08-07T15:31:00.000Z";
    expect((await publishBatch(request({ artifacts: changed }, token))).status).toBe(409);
  });
});
