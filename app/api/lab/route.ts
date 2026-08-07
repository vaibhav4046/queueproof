import { apiError, noStoreJson } from "../../../lib/server/api";
import { requireRequestActor } from "../../../lib/server/identity";
import results from "../../../evals/results/results.json";
import fastRun from "../../../evals/results/live-fast.json";
import liveRun from "../../../evals/results/live-run.json";
import thinkingRun from "../../../evals/results/live-thinking.json";
import pdfRun from "../../../evals/results/pdf-live-run.json";
import { compareLiveModes } from "../../../evals/lib/live-mode-comparison.mjs";
import { requireDb } from "../../../lib/server/runtime";
import { ensureCoreSchema, workspaceForUser } from "../../../lib/server/store";
import { sha256 } from "../../../packages/security/src";
import { isPublicAccessActor, publicDtoForActor } from "../../../lib/server/public-dto";

type ArtifactKind = "auto" | "fast" | "thinking" | "pdf";
type Artifact = Record<string, unknown>;

const parseArtifact = (value: unknown): Artifact | null => {
  try {
    const parsed = JSON.parse(String(value ?? ""));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Artifact : null;
  } catch {
    return null;
  }
};

const artifactReleaseSha = (artifact: Artifact | null) => {
  const release = artifact?.release;
  if (!release || typeof release !== "object" || Array.isArray(release)) return null;
  const commitSha = (release as Artifact).commitSha;
  return typeof commitSha === "string" && /^[0-9a-f]{40}$/i.test(commitSha)
    ? commitSha.toLowerCase()
    : null;
};

const isCurrentReleaseArtifact = (artifact: Artifact | null, currentSha: string | null) =>
  Boolean(
    artifact && currentSha && artifact.releaseVerified === true &&
    artifactReleaseSha(artifact) === currentSha.toLowerCase(),
  );

const isStrictLiveArtifact = (artifact: Artifact | null, currentSha: string | null) => {
  const rows = artifact?.rows;
  return isCurrentReleaseArtifact(artifact, currentSha) &&
    artifact?.status === "measured" && artifact.grader === "grounded-grader-v3" &&
    Array.isArray(rows) && rows.length > 0 && artifact.cases === rows.length;
};

const objectValue = (value: unknown): Artifact =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Artifact : {};

const pick = (value: unknown, keys: readonly string[]): Artifact => {
  const source = objectValue(value);
  return Object.fromEntries(keys.flatMap((key) => source[key] === undefined ? [] : [[key, source[key]]]));
};

const publicRelease = (value: unknown) => pick(value, ["commitSha", "commitRef"]);

const publicFixtureResults = (value: unknown): Artifact => {
  const fixture = objectValue(value);
  const metrics = objectValue(fixture.metrics);
  const router = pick(metrics.router, ["correct", "total", "accuracy"]);
  const perCategory = Object.fromEntries(
    Object.entries(objectValue(metrics.perCategory)).map(([category, entry]) => [
      category,
      pick(entry, ["total", "correct", "accuracy"]),
    ]),
  );
  const notMeasured = Array.isArray(fixture.notMeasured)
    ? fixture.notMeasured.map((entry) => typeof entry === "string"
      ? entry
      : pick(entry, ["metric", "reason"]))
    : [];
  return {
    label: fixture.label,
    caseCount: fixture.caseCount,
    metrics: {
      totalCases: metrics.totalCases,
      router,
      perCategory,
    },
    notMeasured,
    caveat: fixture.caveat,
  };
};

const publicModeSummary = (value: unknown): Artifact => pick(value, [
  "status", "cases", "passed", "requiredFactAccuracy", "citationPrecision",
  "citationCompleteness", "p50LatencyMs", "p95LatencyMs", "meanCalls",
  "totalCostUnits", "release",
]);

const publicModeComparison = (value: unknown): Artifact => {
  const comparison = objectValue(value);
  const rows = Array.isArray(comparison.rows) ? comparison.rows : [];
  return {
    status: comparison.status,
    note: comparison.note,
    comparable: comparison.comparable,
    fast: publicModeSummary(comparison.fast),
    thinking: publicModeSummary(comparison.thinking),
    deltas: comparison.deltas === null
      ? null
      : pick(comparison.deltas, [
          "thinkingMinusFastPasses", "thinkingMinusFastFactAccuracy",
          "thinkingMinusFastP50LatencyMs", "thinkingToFastP50LatencyRatio",
          "thinkingMinusFastMeanCalls", "thinkingMinusFastCostUnits",
        ]),
    rows: rows.map((row) => {
      const entry = objectValue(row);
      return {
        id: entry.id,
        label: entry.label,
        fast: pick(entry.fast, ["pass", "requiredFactRecall", "latencyMs", "callCount", "costUnits"]),
        thinking: pick(entry.thinking, ["pass", "requiredFactRecall", "latencyMs", "callCount", "costUnits"]),
      };
    }),
  };
};

/**
 * A benchmark publisher can attach arbitrary diagnostic fields. Anonymous visitors
 * receive only the reviewed product metrics and comparison copy; raw cited sources,
 * request traces, runner health and operator diagnostics stay private.
 */
const publicLiveArtifact = (artifact: Artifact | null): Artifact | null => {
  if (!artifact) return null;
  const rows = Array.isArray(artifact.rows) ? artifact.rows : [];
  return {
    status: artifact.status,
    grader: artifact.grader,
    target: null,
    generatedAt: artifact.generatedAt,
    cases: artifact.cases,
    passed: artifact.passed,
    connectors: Array.isArray(artifact.connectors)
      ? artifact.connectors.filter((value): value is string => typeof value === "string")
      : [],
    allThreeProviders: artifact.allThreeProviders,
    fast: artifact.fast,
    thinking: artifact.thinking,
    latencyMs: pick(artifact.latencyMs, ["p50", "p95", "min", "max"]),
    quality: pick(artifact.quality, [
      "requiredFactAccuracy", "requiredFactRecall", "citationPrecision",
      "citationCompleteness", "unsupportedClaimRate", "relevancePrecision",
      "irrelevantClaimRate", "relevanceRequirementPasses",
      "zeroKnowinglyUnsupportedClaims", "zeroIrrelevantClaims", "note",
    ]),
    release: publicRelease(artifact.release),
    rows: rows.map((row) => {
      const value = objectValue(row);
      return {
        id: value.id,
        runId: value.runId,
        label: value.label,
        question: value.question,
        expected: value.expected,
        actual: value.actual,
        pass: value.pass,
        mode: value.mode,
        latencyMs: value.latencyMs,
        callCount: value.callCount,
        sources: value.sources,
        providers: Array.isArray(value.providers)
          ? value.providers.filter((provider): provider is string => typeof provider === "string")
          : [],
        relevancePrecision: value.relevancePrecision,
        irrelevantClaimRate: value.irrelevantClaimRate,
        costUnits: value.costUnits,
      };
    }),
  };
};

const publicPdfArtifact = (artifact: Artifact | null): Artifact | null => artifact ? {
  status: artifact.status,
  target: null,
  generatedAt: artifact.generatedAt,
  document: pick(artifact.document, ["filename", "pages", "sha256"]),
  cases: artifact.cases,
  passed: artifact.passed,
  canaries: pick(artifact.canaries, ["beginning", "middle", "end"]),
  latencyMs: pick(artifact.latencyMs, ["p50", "p95", "min", "max"]),
  calls: pick(artifact.calls, ["median", "mean", "min", "max"]),
  quality: pick(artifact.quality, [
    "requiredFactAccuracy", "requiredFactRecall", "citationPrecision",
    "citationCompleteness", "unsupportedClaimRate", "relevancePrecision",
    "irrelevantClaimRate", "relevanceRequirementPasses",
    "zeroKnowinglyUnsupportedClaims", "zeroIrrelevantClaims",
  ]),
  crossSource: pick(artifact.crossSource, ["status", "pass"]),
  release: publicRelease(artifact.release),
} : null;

/**
 * Serve the evaluation results produced by `node scripts/run-evals.mjs`.
 *
 * The file is imported rather than read from disk so it is bundled with the deployment
 * and cannot silently 404 on a serverless filesystem. It contains only measured values:
 * anything the offline suite cannot compute — citation precision and recall, latency,
 * HydraDB call counts, cost — is absent here rather than defaulted to a number, because
 * a zero would read as a measurement.
 */
export async function GET() {
  try {
    const actor = await requireRequestActor();
    const currentSha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.QUEUEPROOF_RELEASE_SHA || null;
    const workspace = await workspaceForUser(actor.id);
    const persisted = new Map<ArtifactKind, Artifact>();
    if (workspace && currentSha) {
      await ensureCoreSchema();
      const rows = await requireDb().prepare(
        `SELECT kind, artifact_json AS artifactJson, artifact_hash AS artifactHash
         FROM benchmark_artifacts
         WHERE workspace_id = ? AND release_sha = ?`,
      ).bind(String(workspace.id), currentSha).all<{
        kind: ArtifactKind;
        artifactJson: string;
        artifactHash: string;
      }>();
      for (const row of rows.results) {
        const artifact = parseArtifact(row.artifactJson);
        const hashMatches = await sha256(row.artifactJson) === row.artifactHash;
        if (
          artifact && hashMatches && isCurrentReleaseArtifact(artifact, currentSha) &&
          ["auto", "fast", "thinking", "pdf"].includes(row.kind)
        ) {
          persisted.set(row.kind, artifact);
        }
      }
    }
    const bundledLive = liveRun as unknown as Artifact;
    const bundledFast = fastRun as unknown as Artifact;
    const bundledThinking = thinkingRun as unknown as Artifact;
    const bundledPdf = pdfRun as unknown as Artifact;
    const selectedLive = persisted.get("auto") ??
      (isCurrentReleaseArtifact(bundledLive, currentSha) ? bundledLive : null);
    const selectedFast = persisted.get("fast") ??
      (isCurrentReleaseArtifact(bundledFast, currentSha) ? bundledFast : null);
    const selectedThinking = persisted.get("thinking") ??
      (isCurrentReleaseArtifact(bundledThinking, currentSha) ? bundledThinking : null);
    const selectedPdf = persisted.get("pdf") ??
      (isCurrentReleaseArtifact(bundledPdf, currentSha) ? bundledPdf : null);
    const strictArtifact = isStrictLiveArtifact(selectedLive, currentSha);
    const currentRef = process.env.VERCEL_GIT_COMMIT_REF || process.env.QUEUEPROOF_RELEASE_REF || null;
    const publicAccess = isPublicAccessActor(actor);
    const liveForResponse = publicAccess ? publicLiveArtifact(selectedLive) : selectedLive;
    const pdfForResponse = publicAccess ? publicPdfArtifact(selectedPdf) : selectedPdf;
    const comparison = compareLiveModes(selectedFast, selectedThinking);
    const response = {
      ok: true,
      results: {
        ...(publicAccess ? {
          fixture: publicFixtureResults((results as Artifact).fixture),
        } : results),
        generatedAt: strictArtifact ? selectedLive?.generatedAt ?? null : null,
        currentRelease: {
          commitSha: currentSha,
          commitRef: currentRef,
        },
        live: strictArtifact
          ? { ...liveForResponse, storage: persisted.has("auto") ? "durable" : "bundled" }
          : {
              status: "awaiting_current_release_measurement",
              storage: "none",
              note: "No benchmark results have been recorded for this deployed release. Run the published command to measure it.",
              target: bundledLive.target,
              generatedAt: null,
              cases: 0,
              rows: [],
              historical: {
                generatedAt: bundledLive.generatedAt ?? null,
                releaseSha: artifactReleaseSha(bundledLive),
              },
            },
        modeComparison: publicAccess ? publicModeComparison(comparison) : comparison,
        pdf: pdfForResponse
          ? { ...pdfForResponse, status: "measured", storage: persisted.has("pdf") ? "durable" : "bundled" }
          : {
              status: "awaiting_current_release_measurement",
              storage: "none",
              note: "No large-document benchmark has been recorded for this deployed release. Run the published PDF benchmark command to measure it.",
              target: bundledPdf.target,
              generatedAt: null,
              document: bundledPdf.document,
              cases: null,
              passed: null,
              canaries: {},
              latencyMs: {},
              quality: {},
              crossSource: { status: "not_measured", pass: false },
              rows: [],
              historical: {
                generatedAt: bundledPdf.generatedAt ?? null,
                releaseSha: artifactReleaseSha(bundledPdf),
              },
            },
      },
    };
    return noStoreJson(publicDtoForActor(actor, response, {
      workspaceId: workspace ? String(workspace.id) : undefined,
    }));
  } catch (error) {
    return apiError(error);
  }
}
