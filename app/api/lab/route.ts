import { apiError, noStoreJson } from "../../../lib/server/api";
import { requireRequestActor } from "../../../lib/server/identity";
import results from "../../../evals/results/results.json";
import fastRun from "../../../evals/results/live-fast.json";
import liveRun from "../../../evals/results/live-run.json";
import thinkingRun from "../../../evals/results/live-thinking.json";
import pdfRun from "../../../evals/results/pdf-live-run.json";
import { compareLiveModes } from "../../../evals/lib/live-mode-comparison.mjs";

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
    await requireRequestActor();
    const strictArtifact = (liveRun as { grader?: string }).grader === "grounded-grader-v2";
    return noStoreJson({
      ok: true,
      results: {
        ...results,
        generatedAt: liveRun.generatedAt,
        currentRelease: {
          commitSha: process.env.VERCEL_GIT_COMMIT_SHA || process.env.QUEUEPROOF_RELEASE_SHA || null,
          commitRef: process.env.VERCEL_GIT_COMMIT_REF || process.env.QUEUEPROOF_RELEASE_REF || null,
        },
        live: strictArtifact
          ? { status: "measured", ...liveRun }
          : {
              status: "legacy_evidence",
              note: "A strict grounded-grader-v2 production rerun is pending; legacy live rows are excluded from readiness metrics.",
              target: liveRun.target,
              generatedAt: liveRun.generatedAt,
              cases: 0,
              rows: [],
            },
        modeComparison: compareLiveModes(fastRun, thinkingRun),
        pdf: pdfRun,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
