import { createRemoteJWKSet, jwtVerify } from "jose";
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
const CONNECTOR_PROVIDERS = new Set([
  "attio", "bigtable", "calendly", "confluence", "dropbox", "freshdesk",
  "github", "gitlab", "gmail", "google-calendar", "google-drive", "intercom",
  "jira", "linear", "notion", "posthog", "shortcut", "slack", "stripe", "twitter",
]);
const GITHUB_OIDC_ISSUER = "https://token.actions.githubusercontent.com";
const GITHUB_OIDC_AUDIENCE = "https://queueproof.vercel.app/api/lab/artifacts/batch";
const GITHUB_REPOSITORY = "vaibhav4046/queueproof";
const GITHUB_REPOSITORY_ID = "1319245359";
const GITHUB_OIDC_KEYS = createRemoteJWKSet(
  new URL("https://token.actions.githubusercontent.com/.well-known/jwks"),
);
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

async function authorisePublisher(request: Request, current: { sha: string; ref: string }) {
  const suppliedToken = request.headers.get("x-queueproof-benchmark-once")?.trim() ?? "";
  if (suppliedToken.length >= 32 && suppliedToken.length <= 512) {
    const suppliedHash = await sha256(suppliedToken);
    if (constantTimeEqual(suppliedHash, operatorTokenHash())) return suppliedHash;
  }

  const authorization = request.headers.get("authorization")?.trim() ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return null;
  const token = authorization.slice(7).trim();
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, GITHUB_OIDC_KEYS, {
      issuer: GITHUB_OIDC_ISSUER,
      audience: GITHUB_OIDC_AUDIENCE,
      algorithms: ["RS256"],
    });
    const repository = typeof payload.repository === "string" ? payload.repository : "";
    const repositoryId = typeof payload.repository_id === "string" ? payload.repository_id : "";
    const visibility = typeof payload.repository_visibility === "string" ? payload.repository_visibility : "";
    const ref = typeof payload.ref === "string" ? payload.ref : "";
    const sha = typeof payload.sha === "string" ? payload.sha.toLowerCase() : "";
    const eventName = typeof payload.event_name === "string" ? payload.event_name : "";
    const subject = typeof payload.sub === "string" ? payload.sub : "";
    if (
      repository !== GITHUB_REPOSITORY ||
      repositoryId !== GITHUB_REPOSITORY_ID ||
      visibility !== "private" ||
      ref !== "refs/heads/main" ||
      eventName !== "push" ||
      sha !== current.sha.toLowerCase() ||
      !subject.startsWith(`repo:${GITHUB_REPOSITORY}:`)
    ) return null;
    // All short-lived OIDC tokens for one exact production release map to one
    // durable consumption identity so retries preserve atomic one-time semantics.
    return sha256(`github-oidc:${GITHUB_REPOSITORY_ID}:${current.sha.toLowerCase()}`);
  } catch {
    return null;
  }
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

const positiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;

function normaliseProvider(input: unknown, allowDocument: boolean) {
  if (typeof input !== "string") return null;
  let provider = input.trim().toLowerCase().replace(/[\s_]+/g, "-");
  if (provider === "x" || provider === "twitter-x") provider = "twitter";
  if (provider === "googledrive") provider = "google-drive";
  if (provider === "googlecalendar") provider = "google-calendar";
  if (provider === "git-hub") provider = "github";
  if (provider === "git-lab") provider = "gitlab";
  if (provider === "post-hog") provider = "posthog";
  if (provider === "fresh-desk") provider = "freshdesk";
  if (provider === "document") return allowDocument ? provider : null;
  return CONNECTOR_PROVIDERS.has(provider) ? provider : null;
}

function normaliseProviders(input: unknown, allowDocument: boolean): string[] | null {
  if (!Array.isArray(input) || input.length === 0) return null;
  const providers = input.map((value) => normaliseProvider(value, allowDocument));
  if (providers.some((provider) => provider === null)) return null;
  return [...new Set(providers as string[])];
}

const sameProviderSet = (left: string[], right: string[]) =>
  left.length === right.length && left.every((provider) => right.includes(provider));

function strictRow(kind: ArtifactKind, input: unknown) {
  const row = record(input);
  const claimCount = row.claimCount;
  const relevantClaimCount = row.relevantClaimCount;
  const providers = normaliseProviders(row.providers, kind === "pdf");
  const factCountsPass = positiveInteger(row.requiredFactCount) &&
    row.matchedFactCount === row.requiredFactCount && row.requiredFactRecall === 1;
  const claimCountsPass = positiveInteger(claimCount) && positiveInteger(relevantClaimCount) &&
    relevantClaimCount === claimCount && row.supportedClaimCount === claimCount &&
    positiveInteger(row.claimCitationPairCount) && row.supportedClaimCitationPairCount === row.claimCitationPairCount;
  const modePass = kind === "pdf"
    ? (row.mode === "fast" || row.mode === "thinking") && row.documentReceipt === true &&
      row.exactIdPass === true && providers !== null && providers.length === 1 && providers[0] === "document"
    : row.requestedMode === kind && row.modeHonored === true &&
      (kind === "auto" ? row.mode === "fast" || row.mode === "thinking" : row.mode === kind) &&
      providers !== null && providers.length > 0;
  return row.apiOk === true && row.pass === true && factCountsPass && claimCountsPass && modePass &&
    row.providerPass === true && row.citationPass === true &&
    row.citationPrecision === 1 && row.citationCompleteness === 1 && row.unsupportedClaimRate === 0 &&
    row.relevancePass === true &&
    row.relevancePrecision === 1 &&
    row.irrelevantClaimRate === 0 &&
    (row.requiresContradiction !== true || row.contradictionPass === true) &&
    Array.isArray(row.invalidCitationIds) && row.invalidCitationIds.length === 0 &&
    Array.isArray(row.unsupportedClaims) && row.unsupportedClaims.length === 0 &&
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
    artifact.passed !== rows.length || !rows.every((row) => strictRow(kind, row))
  ) {
    throw new Response("Every measured benchmark case must pass strict v3 relevance.", { status: 400 });
  }
  if (!strictQuality(artifact) || record(artifact.quality).relevanceRequirementPasses !== rows.length) {
    throw new Response("Benchmark quality must be perfect under the strict v3 grader.", { status: 400 });
  }
  if (kind === "pdf") {
    const canaries = record(artifact.canaries);
    const crossSource = record(artifact.crossSource);
    const crossProviders = normaliseProviders(crossSource.providers, true);
    const nonDocumentProviders = crossProviders?.filter((provider) => provider !== "document") ?? [];
    const declaredNonDocumentProviders = normaliseProviders(crossSource.nonDocumentProviders, false);
    const providerRule = record(crossSource.requiredProviderRule);
    if (
      canaries.beginning !== true || canaries.middle !== true || canaries.end !== true ||
      crossSource.apiOk !== true || crossSource.pass !== true || crossSource.citationPass !== true ||
      crossSource.documentProviderPass !== true || crossSource.connectorProviderPass !== true ||
      providerRule.document !== true || providerRule.minimumNonDocumentProviders !== 2 ||
      !positiveInteger(crossSource.requiredFactCount) ||
      crossSource.matchedFactCount !== crossSource.requiredFactCount || crossSource.requiredFactRecall !== 1 ||
      !positiveInteger(crossSource.claimCount) || !positiveInteger(crossSource.relevantClaimCount) ||
      crossSource.relevantClaimCount !== crossSource.claimCount ||
      crossSource.supportedClaimCount !== crossSource.claimCount ||
      !positiveInteger(crossSource.citationCount) || crossSource.mode !== "thinking" ||
      crossSource.citationPrecision !== 1 || crossSource.citationCompleteness !== 1 ||
      crossSource.unsupportedClaimRate !== 0 || crossSource.relevancePass !== true ||
      crossSource.relevancePrecision !== 1 || crossSource.irrelevantClaimRate !== 0 ||
      !Array.isArray(crossSource.invalidCitationIds) || crossSource.invalidCitationIds.length !== 0 ||
      !Array.isArray(crossSource.unsupportedClaims) || crossSource.unsupportedClaims.length !== 0 ||
      !Array.isArray(crossSource.irrelevantClaims) || crossSource.irrelevantClaims.length !== 0 ||
      crossProviders === null || !crossProviders.includes("document") || nonDocumentProviders.length < 2 ||
      declaredNonDocumentProviders === null || !sameProviderSet(nonDocumentProviders, declaredNonDocumentProviders)
    ) {
      throw new Response("The PDF benchmark must pass every canary and strict cross-source relevance.", { status: 400 });
    }
  } else {
    const connectors = normaliseProviders(artifact.connectors, false);
    const rowProviders = normaliseProviders(rows.flatMap((row) => {
      const providers = record(row).providers;
      return Array.isArray(providers) ? providers : [];
    }), false);
    if (
      artifact.requestedMode !== kind || artifact.status !== "measured" || connectors === null ||
      connectors.length < 3 || rowProviders === null || !sameProviderSet(connectors, rowProviders)
    ) {
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
 * This is deliberately separate from the long-lived operator endpoint. A batch is
 * validated in full before its publisher identity is consumed, then the credential
 * receipt, four artifact rows, and audit event commit atomically. Raw credentials are
 * never stored.
 */
export async function POST(request: Request) {
  try {
    if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") return hidden();
    if (Date.now() >= Date.parse(OPERATOR_TOKEN_EXPIRES_AT)) return hidden();

    const current = releaseIdentity();
    if (!/^[0-9a-f]{40}$/i.test(current.sha) || !current.ref) {
      return noStoreJson({ ok: false, error: "The running release has no verifiable SHA and ref." }, { status: 503 });
    }
    const publisherHash = await authorisePublisher(request, current);
    if (!publisherHash) return hidden();

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
    ).bind(publisherHash).first<ConsumedToken>();
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
      return noStoreJson({ ok: false, error: "This publisher identity has already been consumed." }, { status: 409 });
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
      ).bind(publisherHash, workspaceId, current.sha, artifactSetHash, OPERATOR_TOKEN_EXPIRES_AT),
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
      // A racing identical request may win the unique publisher insert. Confirm the
      // entire committed set before treating that race as an idempotent success.
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
