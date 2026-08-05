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
    artifact?.status === "measured" && artifact.grader === "grounded-grader-v2" &&
    Array.isArray(rows) && rows.length > 0 && artifact.cases === rows.length;
};

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
    return noStoreJson({
      ok: true,
      results: {
        ...results,
        generatedAt: strictArtifact ? selectedLive?.generatedAt ?? null : null,
        currentRelease: {
          commitSha: currentSha,
          commitRef: currentRef,
        },
        live: strictArtifact
          ? { ...selectedLive, storage: persisted.has("auto") ? "durable" : "bundled" }
          : {
              status: "awaiting_current_release_measurement",
              storage: "none",
              note: "No strict artifact is bound to the running commit. Historical bundled rows are excluded from current-release metrics.",
              target: bundledLive.target,
              generatedAt: null,
              cases: 0,
              rows: [],
              historical: {
                generatedAt: bundledLive.generatedAt ?? null,
                releaseSha: artifactReleaseSha(bundledLive),
              },
            },
        modeComparison: compareLiveModes(selectedFast, selectedThinking),
        pdf: selectedPdf
          ? { ...selectedPdf, status: "measured", storage: persisted.has("pdf") ? "durable" : "bundled" }
          : {
              status: "awaiting_current_release_measurement",
              storage: "none",
              note: "No large-document artifact is bound to the running commit. Historical metrics are withheld.",
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
    });
  } catch (error) {
    return apiError(error);
  }
}
