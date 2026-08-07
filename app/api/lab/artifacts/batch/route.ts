import { apiError, noStoreJson } from "../../../../../lib/server/api";
import { requireDb, runtimeEnv } from "../../../../../lib/server/runtime";
import { createId, ensureCoreSchema } from "../../../../../lib/server/store";
import { sha256 } from "../../../../../packages/security/src";

const ARTIFACT_KINDS = ["auto", "fast", "thinking", "pdf"] as const;
type ArtifactKind = typeof ARTIFACT_KINDS[number];
type Row = Record<string, unknown>;

const STRICT_GRADER = "grounded-grader-v3";
const MAX_REQUEST_BYTES = 2_000_000;
const OPERATOR_TOKEN_EXPIRES_AT = "2026-08-08T06:00:00.000Z";
// SHA-256 of a 256-bit one-time token. The preimage is never committed or logged.
const COMMITTED_OPERATOR_TOKEN_HASH =
  "c0802a40caa795a2e1ae472efbb0d402b3ea713a68ac75fff10b6efc5fbbfc61";

const record = (value: unknown): Row =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value as Row : {};

const hidden = () => noStoreJson({ ok: false }, { status: 404 });

async function readBoundedBody(request: Request) {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const bytes = Number(declaredLength);
    if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > MAX_REQUEST_BYTES) {
      throw new Response("Benchmark batch is too large.", { status: 413 });
    }
  }
  if (!request.body) return "";

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytesRead = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      if (bytesRead > MAX_REQUEST_BYTES) {
        await reader.cancel();
        throw new Response("Benchmark batch is too large.", { status: 413 });
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return text;
  } catch (error) {
    if (error instanceof Response) throw error;
    throw new Response("Benchmark batch must be valid UTF-8.", { status: 400 });
  } finally {
    reader.releaseLock();
  }
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

function operatorTokenHash() {
  const testOverride = process.env.QUEUEPROOF_BENCHMARK_ONCE_TOKEN_HASH?.trim() ?? "";
  if (process.env.NODE_ENV === "test" && /^[0-9a-f]{64}$/i.test(testOverride)) {
    return testOverride.toLowerCase();
  }
  return COMMITTED_OPERATOR_TOKEN_HASH;
}

function releaseIdentity() {
  return {
    sha: process.env.VERCEL_GIT_COMMIT_SHA || process.env.QUEUEPROOF_RELEASE_SHA || "",
    ref: process.env.VERCEL_GIT_COMMIT_REF || process.env.QUEUEPROOF_RELEASE_REF || "",
  };
}

function strictQuality(artifact: Row) {
  const quality = record(artifact.quality);
  return quality.requiredFactAccuracy === 1 &&
    quality.citationPrecision === 1 &&
    quality.citationCompleteness === 1 &&
    quality.unsupportedClaimRate === 0 &&
    quality.relevancePrecision === 1 &&
    quality.irrelevantClaimRate === 0 &&
    quality.zeroKnowinglyUnsupportedClaims === true &&
    quality.zeroIrrelevantClaims === true;
}

function strictRow(input: unknown) {
  const row = record(input);
  return row.pass === true &&
    row.relevancePass === true &&
    row.relevancePrecision === 1 &&
    row.irrelevantClaimRate === 0 &&
    typeof row.relevantClaimCount === "number" && Number.isFinite(row.relevantClaimCount) &&
    row.relevantClaimCount >= 0 &&
    Array.isArray(row.irrelevantClaims) && row.irrelevantClaims.length === 0;
}

async function normaliseArtifact(kind: ArtifactKind, input: unknown, current: { sha: string; ref: string }) {
  const artifact = record(input);
  if (artifact.grader !== STRICT_GRADER || artifact.releaseVerified !== true) {
    throw new Response("Only strict, release-verified grounded-grader-v3 artifacts are accepted.", { status: 400 });
  }
  const rows = artifact.rows;
  if (
    !Array.isArray(rows) || rows.length === 0 || artifact.cases !== rows.length ||
    artifact.passed !== rows.length || !rows.every(strictRow)
  ) {
    throw new Response("Every measured benchmark case must pass strict v3 relevance.", { status: 400 });
  }
  if (!strictQuality(artifact) || record(artifact.quality).relevanceRequirementPasses !== rows.length) {
    throw new Response("Benchmark quality must be perfect under the strict v3 grader.", { status: 400 });
  }
  if (kind === "pdf") {
    const canaries = record(artifact.canaries);
    const crossSource = record(artifact.crossSource);
    const crossProviders = Array.isArray(crossSource.providers)
      ? [...new Set(crossSource.providers.filter((provider): provider is string => typeof provider === "string"))]
      : [];
    if (
      canaries.beginning !== true || canaries.middle !== true || canaries.end !== true ||
      crossSource.pass !== true || crossSource.relevancePass !== true ||
      crossSource.relevancePrecision !== 1 || crossSource.irrelevantClaimRate !== 0 ||
      !Array.isArray(crossSource.irrelevantClaims) || crossSource.irrelevantClaims.length !== 0 ||
      !crossProviders.includes("document") || crossProviders.filter((provider) => provider !== "document").length < 2
    ) {
      throw new Response("The PDF benchmark must pass every canary and strict cross-source relevance.", { status: 400 });
    }
  } else {
    const connectors = Array.isArray(artifact.connectors)
      ? new Set(artifact.connectors.filter((provider): provider is string => typeof provider === "string" && provider.length > 0))
      : new Set<string>();
    if (artifact.requestedMode !== kind || artifact.status !== "measured" || connectors.size < 3) {
      throw new Response(`Artifact mode or connector coverage does not match ${kind}.`, { status: 400 });
    }
  }

  const release = record(artifact.release);
  const measuredSha = typeof release.commitSha === "string" ? release.commitSha.toLowerCase() : "";
  const measuredRef = typeof release.commitRef === "string" ? release.commitRef.trim() : "";
  if (!/^[0-9a-f]{40}$/.test(measuredSha) || measuredSha !== current.sha.toLowerCase() || measuredRef !== current.ref) {
    throw new Response("Artifact release does not match the running release.", { status: 409 });
  }
  const generatedAt = typeof artifact.generatedAt === "string" && Number.isFinite(Date.parse(artifact.generatedAt))
    ? new Date(artifact.generatedAt).toISOString()
    : "";
  if (!generatedAt || Date.parse(generatedAt) > Date.now() + 5 * 60_000) {
    throw new Response("Artifact generatedAt must be an ISO timestamp.", { status: 400 });
  }

  const normalised = {
    ...artifact,
    generatedAt,
    release: { ...release, commitSha: measuredSha, commitRef: measuredRef },
  };
  const json = JSON.stringify(normalised);
  return { artifact: normalised, json, hash: await sha256(json), generatedAt };
}

type StoredArtifact = { kind: string; artifactHash: string };
type ConsumedToken = { releaseSha: string; artifactSetHash: string };

/**
 * One-time, exact-release benchmark publication.
 *
 * This is intentionally separate from the long-lived operator endpoint. A batch is
 * validated in full before its token is consumed, then the token receipt, four artifact
 * rows, and audit event commit atomically. The raw token is never stored.
 */
export async function POST(request: Request) {
  try {
    if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") return hidden();
    if (Date.now() >= Date.parse(OPERATOR_TOKEN_EXPIRES_AT)) return hidden();

    const suppliedToken = request.headers.get("x-queueproof-benchmark-once")?.trim() ?? "";
    if (suppliedToken.length < 32 || suppliedToken.length > 512) return hidden();
    const suppliedHash = await sha256(suppliedToken);
    if (!constantTimeEqual(suppliedHash, operatorTokenHash())) return hidden();

    const raw = await readBoundedBody(request);
    if (!raw) return noStoreJson({ ok: false, error: "Benchmark batch cannot be empty." }, { status: 400 });
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return noStoreJson({ ok: false, error: "Benchmark batch must be JSON." }, { status: 400 });
    }
    const body = record(parsed);
    if (Object.keys(body).length !== 1 || !("artifacts" in body)) {
      return noStoreJson({ ok: false, error: "The batch body must contain only artifacts." }, { status: 400 });
    }
    const suppliedArtifacts = record(body.artifacts);
    const suppliedKinds = Object.keys(suppliedArtifacts).sort();
    if (
      suppliedKinds.length !== ARTIFACT_KINDS.length ||
      ARTIFACT_KINDS.some((kind) => !suppliedKinds.includes(kind))
    ) {
      return noStoreJson({ ok: false, error: "Provide exactly auto, fast, thinking, and pdf artifacts." }, { status: 400 });
    }

    const current = releaseIdentity();
    if (!/^[0-9a-f]{40}$/i.test(current.sha) || !current.ref) {
      return noStoreJson({ ok: false, error: "The running release has no verifiable SHA and ref." }, { status: 503 });
    }
    const normalised = new Map<ArtifactKind, Awaited<ReturnType<typeof normaliseArtifact>>>();
    for (const kind of ARTIFACT_KINDS) {
      normalised.set(kind, await normaliseArtifact(kind, suppliedArtifacts[kind], current));
    }
    const artifactHashes = Object.fromEntries(
      ARTIFACT_KINDS.map((kind) => [kind, normalised.get(kind)!.hash]),
    ) as Record<ArtifactKind, string>;
    const artifactSetHash = await sha256(JSON.stringify(
      ARTIFACT_KINDS.map((kind) => [kind, normalised.get(kind)!.json]),
    ));

    const env = runtimeEnv() as Record<string, unknown>;
    const workspaceId = typeof env.QUEUEPROOF_PUBLIC_WORKSPACE_ID === "string"
      ? env.QUEUEPROOF_PUBLIC_WORKSPACE_ID.trim()
      : "";
    if (!workspaceId) {
      return noStoreJson({ ok: false, error: "Public workspace is not configured." }, { status: 503 });
    }
    await ensureCoreSchema();
    const db = requireDb();
    const workspace = await db.prepare("SELECT id FROM workspaces WHERE id = ? LIMIT 1")
      .bind(workspaceId).first<{ id: string }>();
    if (!workspace) {
      return noStoreJson({ ok: false, error: "Configured workspace does not exist." }, { status: 503 });
    }

    const readConsumed = () => db.prepare(
      `SELECT release_sha AS releaseSha, artifact_set_hash AS artifactSetHash
       FROM benchmark_publication_tokens WHERE token_hash = ? LIMIT 1`,
    ).bind(suppliedHash).first<ConsumedToken>();
    const readStored = () => db.prepare(
      `SELECT kind, artifact_hash AS artifactHash FROM benchmark_artifacts
       WHERE workspace_id = ? AND release_sha = ? AND kind IN ('auto', 'fast', 'thinking', 'pdf')`,
    ).bind(workspaceId, current.sha).all<StoredArtifact>();
    const rowsMatch = (rows: StoredArtifact[]) =>
      rows.length === ARTIFACT_KINDS.length && ARTIFACT_KINDS.every((kind) =>
        rows.some((row) => row.kind === kind && row.artifactHash === artifactHashes[kind]),
      );
    const success = (idempotent: boolean) => noStoreJson({
      ok: true,
      releaseSha: current.sha,
      releaseRef: current.ref,
      artifactSetHash,
      artifactHashes,
      idempotent,
    });

    const consumed = await readConsumed();
    if (consumed) {
      const stored = await readStored();
      if (
        consumed.releaseSha === current.sha && consumed.artifactSetHash === artifactSetHash &&
        rowsMatch(stored.results)
      ) return success(true);
      return noStoreJson({ ok: false, error: "This one-time publisher has already been consumed." }, { status: 409 });
    }

    const stored = await readStored();
    const storedByKind = new Map(stored.results.map((row) => [row.kind, row.artifactHash]));
    if (ARTIFACT_KINDS.some((kind) => storedByKind.has(kind) && storedByKind.get(kind) !== artifactHashes[kind])) {
      return noStoreJson({ ok: false, error: "A different artifact already exists for this release." }, { status: 409 });
    }

    const statements = [
      db.prepare(
        `INSERT INTO benchmark_publication_tokens
         (token_hash, workspace_id, release_sha, artifact_set_hash, expires_at, used_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      ).bind(suppliedHash, workspaceId, current.sha, artifactSetHash, OPERATOR_TOKEN_EXPIRES_AT),
    ];
    for (const kind of ARTIFACT_KINDS) {
      if (storedByKind.has(kind)) continue;
      const value = normalised.get(kind)!;
      statements.push(db.prepare(
        `INSERT INTO benchmark_artifacts
         (id, workspace_id, kind, release_sha, artifact_json, artifact_hash, generated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        createId("benchmark"), workspaceId, kind, current.sha,
        value.json, value.hash, value.generatedAt,
      ));
    }
    statements.push(db.prepare(
      `INSERT INTO audit_events
       (id, workspace_id, actor_id, operation, operation_id, target_type, target_id, outcome, risk_class, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      createId("audit"), workspaceId, "system:benchmark-one-time-publisher",
      "benchmark.publish_batch", crypto.randomUUID(), "benchmark_artifact_set",
      `${current.sha}:${artifactSetHash}`, "success", "write",
      JSON.stringify({
        kinds: ARTIFACT_KINDS,
        releaseSha: current.sha,
        releaseRef: current.ref,
        artifactSetHash,
        artifactHashes,
      }),
    ));

    try {
      await db.batch(statements);
    } catch (error) {
      // A racing identical request may win the unique token insert. Confirm the entire
      // committed set before treating that race as an idempotent success.
      const racedToken = await readConsumed();
      const racedRows = await readStored();
      if (
        racedToken?.releaseSha === current.sha && racedToken.artifactSetHash === artifactSetHash &&
        rowsMatch(racedRows.results)
      ) return success(true);
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (message.includes("unique") || message.includes("constraint")) {
        return noStoreJson({ ok: false, error: "Benchmark batch conflicted with an existing publication." }, { status: 409 });
      }
      throw error;
    }

    const verifiedRows = await readStored();
    if (!rowsMatch(verifiedRows.results)) {
      throw new Error("Atomic benchmark publication verification failed.");
    }
    return success(false);
  } catch (error) {
    if (error instanceof Response) {
      const message = await error.text();
      return noStoreJson({ ok: false, error: message }, { status: error.status });
    }
    return apiError(error);
  }
}
