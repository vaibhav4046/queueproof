import { apiError, noStoreJson } from "../../../../lib/server/api";
import { runtimeEnv, requireDb } from "../../../../lib/server/runtime";
import { audit, createId, ensureCoreSchema } from "../../../../lib/server/store";
import { sha256 } from "../../../../packages/security/src";

type ArtifactKind = "auto" | "fast" | "thinking" | "pdf";
type Row = Record<string, unknown>;

const record = (value: unknown): Row =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value as Row : {};

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

function releaseIdentity() {
  return {
    sha: process.env.VERCEL_GIT_COMMIT_SHA || process.env.QUEUEPROOF_RELEASE_SHA || "",
    ref: process.env.VERCEL_GIT_COMMIT_REF || process.env.QUEUEPROOF_RELEASE_REF || "",
  };
}

function validKind(value: unknown): value is ArtifactKind {
  return value === "auto" || value === "fast" || value === "thinking" || value === "pdf";
}

/**
 * Publish a measured artifact only after the exact release is serving traffic.
 * This endpoint is deliberately operator-only and uses a separate deployment
 * credential from human owner sessions and MCP tokens.
 */
export async function POST(request: Request) {
  try {
    const env = runtimeEnv() as Record<string, unknown>;
    const configuredToken = typeof env.QUEUEPROOF_BENCHMARK_TOKEN === "string"
      ? env.QUEUEPROOF_BENCHMARK_TOKEN.trim()
      : "";
    const suppliedToken = request.headers.get("x-queueproof-benchmark-token")?.trim() ?? "";
    // A disabled or unauthorised publisher is indistinguishable from a missing route.
    if (configuredToken.length < 32 || !constantTimeEqual(configuredToken, suppliedToken)) {
      return noStoreJson({ ok: false }, { status: 404 });
    }

    const raw = await request.text();
    if (!raw || raw.length > 6_000_000) {
      return noStoreJson({ ok: false, error: "Benchmark artifact must be between 1 byte and 6 MB." }, { status: 413 });
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return noStoreJson({ ok: false, error: "Benchmark artifact request must be JSON." }, { status: 400 });
    }
    const body = record(parsed);
    const kind = body.kind;
    const artifact = record(body.artifact);
    if (!validKind(kind) || Object.keys(artifact).length === 0) {
      return noStoreJson({ ok: false, error: "Provide a valid artifact kind and object." }, { status: 400 });
    }
    if (artifact.grader !== "grounded-grader-v2" || artifact.releaseVerified !== true) {
      return noStoreJson({ ok: false, error: "Only strict, release-verified grounded-grader-v2 artifacts are accepted." }, { status: 400 });
    }
    const rows = artifact.rows;
    if (!Array.isArray(rows) || rows.length === 0 || artifact.cases !== rows.length) {
      return noStoreJson({ ok: false, error: "Artifact cases must match a non-empty measured row set." }, { status: 400 });
    }
    const requestedMode = artifact.requestedMode;
    if (kind !== "pdf" && requestedMode !== kind) {
      return noStoreJson({ ok: false, error: `Artifact mode does not match ${kind}.` }, { status: 400 });
    }
    if (kind !== "pdf" && artifact.status !== "measured") {
      return noStoreJson({ ok: false, error: "Live benchmark artifacts must have measured status." }, { status: 400 });
    }
    const release = record(artifact.release);
    const measuredSha = typeof release.commitSha === "string" ? release.commitSha : "";
    const measuredRef = typeof release.commitRef === "string" ? release.commitRef.trim() : "";
    const current = releaseIdentity();
    if (!current.sha) {
      return noStoreJson({ ok: false, error: "The running release has no verifiable commit SHA." }, { status: 503 });
    }
    if (!/^[0-9a-f]{40}$/i.test(measuredSha) || measuredSha.toLowerCase() !== current.sha.toLowerCase()) {
      return noStoreJson({ ok: false, error: "Artifact SHA does not match the running release." }, { status: 409 });
    }
    if (!measuredRef) {
      return noStoreJson({ ok: false, error: "Artifact release ref is required." }, { status: 400 });
    }
    const generatedAt = typeof artifact.generatedAt === "string" && Number.isFinite(Date.parse(artifact.generatedAt))
      ? new Date(artifact.generatedAt).toISOString()
      : "";
    if (!generatedAt) {
      return noStoreJson({ ok: false, error: "Artifact generatedAt must be an ISO timestamp." }, { status: 400 });
    }
    const workspaceId = typeof env.QUEUEPROOF_PUBLIC_WORKSPACE_ID === "string"
      ? env.QUEUEPROOF_PUBLIC_WORKSPACE_ID.trim()
      : "";
    if (!workspaceId) {
      return noStoreJson({ ok: false, error: "Public workspace is not configured." }, { status: 503 });
    }

    await ensureCoreSchema();
    const workspace = await requireDb().prepare(`SELECT id FROM workspaces WHERE id = ? LIMIT 1`)
      .bind(workspaceId).first<{ id: string }>();
    if (!workspace) {
      return noStoreJson({ ok: false, error: "Configured workspace does not exist." }, { status: 503 });
    }
    const normalisedArtifact = {
      ...artifact,
      generatedAt,
      release: { ...release, commitSha: measuredSha.toLowerCase(), commitRef: measuredRef },
    };
    const artifactJson = JSON.stringify(normalisedArtifact);
    const artifactHash = await sha256(artifactJson);
    const id = createId("benchmark");
    await requireDb().prepare(
      `INSERT INTO benchmark_artifacts
       (id, workspace_id, kind, release_sha, artifact_json, artifact_hash, generated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(workspace_id, kind, release_sha) DO UPDATE SET
         artifact_json = excluded.artifact_json,
         artifact_hash = excluded.artifact_hash,
         generated_at = excluded.generated_at,
         updated_at = CURRENT_TIMESTAMP
       WHERE excluded.generated_at > benchmark_artifacts.generated_at
          OR (excluded.generated_at = benchmark_artifacts.generated_at
              AND excluded.artifact_hash = benchmark_artifacts.artifact_hash)`,
    ).bind(id, workspaceId, kind, current.sha, artifactJson, artifactHash, generatedAt).run();
    const writeResult = await requireDb().prepare(
      `SELECT artifact_hash AS artifactHash, generated_at AS generatedAt
       FROM benchmark_artifacts WHERE workspace_id = ? AND kind = ? AND release_sha = ? LIMIT 1`,
    ).bind(workspaceId, kind, current.sha).first<{ artifactHash: string; generatedAt: string }>();
    if (writeResult?.artifactHash !== artifactHash || writeResult.generatedAt !== generatedAt) {
      return noStoreJson({ ok: false, error: "A newer artifact already exists for this release." }, { status: 409 });
    }
    await audit({
      workspaceId,
      actorId: "system:benchmark-publisher",
      operation: "benchmark.publish",
      targetType: "benchmark_artifact",
      targetId: `${kind}:${current.sha}`,
      outcome: "success",
      riskClass: "write",
      metadata: { kind, releaseSha: current.sha, releaseRef: current.ref, artifactHash },
    });
    return noStoreJson({ ok: true, kind, releaseSha: current.sha, artifactHash });
  } catch (error) {
    return apiError(error);
  }
}
