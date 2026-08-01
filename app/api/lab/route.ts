import { apiError, noStoreJson } from "../../../lib/server/api";
import { requireRequestActor } from "../../../lib/server/identity";
import results from "../../../evals/results/results.json";

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
    return noStoreJson({ ok: true, results });
  } catch (error) {
    return apiError(error);
  }
}
