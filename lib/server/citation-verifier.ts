import {
  composeGroundedAnswer,
  MOST_RECENT_DELIVERY_FRAME,
  type GroundedClaim,
  type SynthesisEvidence,
} from "./synthesis";

/**
 * Optional second opinion on claim support from a local cross-encoder sidecar
 * (POST {url}/score). It can only remove claims, never add or reword them, and
 * any sidecar failure leaves the lexical synthesis untouched with a visible
 * "unavailable" status. Enabled only by QUEUEPROOF_RERANKER_URL.
 */
export const RERANKER_MAX_PAIRS = 256;
export const RERANKER_DEFAULT_TIMEOUT_MS = 2_000;

export type VerifierOptions = {
  url: string;
  threshold: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

export type ClaimVerdict = { supported: boolean; score: number };

export type VerifyResult =
  | { status: "applied"; model: string; verdicts: ClaimVerdict[] }
  | { status: "unavailable"; reason: string };

type Pair = { claim: string; passage: string };

async function scoreBatch(pairs: Pair[], options: VerifierOptions): Promise<{ scores: number[]; model: string }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(new URL("/score", options.url), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pairs }),
    signal: AbortSignal.timeout(options.timeoutMs ?? RERANKER_DEFAULT_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`sidecar returned HTTP ${response.status}`);
  const body = await response.json() as { scores?: unknown; model?: unknown };
  const scores = body.scores;
  if (!Array.isArray(scores) || scores.length !== pairs.length ||
      !scores.every((score) => typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 1)) {
    throw new Error("sidecar returned a malformed score list");
  }
  return { scores, model: typeof body.model === "string" ? body.model : "unknown" };
}

/** A claim's score is the max sidecar score over its cited evidence (title + ". " + excerpt). */
export async function verifyClaims(
  claims: GroundedClaim[],
  evidence: SynthesisEvidence[],
  options: VerifierOptions,
): Promise<VerifyResult> {
  const byId = new Map(evidence.map((item) => [item.id, item]));
  const pairs: Array<Pair & { claimIndex: number }> = claims.flatMap((claim, claimIndex) =>
    claim.evidenceIds.flatMap((id) => {
      const item = byId.get(id);
      return item ? [{ claimIndex, claim: claim.text, passage: `${item.title}. ${item.excerpt}` }] : [];
    }));
  const best = claims.map(() => 0);
  let model = "unknown";
  try {
    for (let start = 0; start < pairs.length; start += RERANKER_MAX_PAIRS) {
      const batch = pairs.slice(start, start + RERANKER_MAX_PAIRS);
      const result = await scoreBatch(batch.map(({ claim, passage }) => ({ claim, passage })), options);
      model = result.model;
      batch.forEach((pair, index) => {
        best[pair.claimIndex] = Math.max(best[pair.claimIndex], result.scores[index]);
      });
    }
  } catch (error) {
    return { status: "unavailable", reason: error instanceof Error ? error.message : "sidecar request failed" };
  }
  return {
    status: "applied",
    model,
    verdicts: best.map((score) => ({ supported: score >= options.threshold, score })),
  };
}

type SynthesisLike = {
  answer: string;
  claims: GroundedClaim[];
  missingInformation: string[];
  validation: { evidenceCount: number };
};

/**
 * Applies the verifier to a finished synthesis. Claims below threshold move to
 * `validation.verifier.unverifiedClaims`; the answer, missing facets, and
 * grounded/partial/abstained status are recomputed from the claims that remain.
 * Never throws: an unavailable sidecar returns the synthesis unchanged apart
 * from the visible verifier status.
 */
export async function applyCitationVerifier<T extends SynthesisLike>(
  question: string,
  synthesis: T,
  evidence: SynthesisEvidence[],
  options: VerifierOptions,
) {
  const result = await verifyClaims(synthesis.claims, evidence, options);
  if (result.status === "unavailable") {
    return {
      ...synthesis,
      validation: {
        ...synthesis.validation,
        verifier: { status: "unavailable" as const, reason: result.reason, threshold: options.threshold },
      },
    };
  }
  const kept = synthesis.claims.filter((_, index) => result.verdicts[index].supported);
  const unverifiedClaims = synthesis.claims
    .map((claim, index) => ({ ...claim, score: result.verdicts[index].score }))
    .filter((_, index) => !result.verdicts[index].supported);
  const frame = synthesis.answer.startsWith(MOST_RECENT_DELIVERY_FRAME) && kept[0] === synthesis.claims[0]
    ? MOST_RECENT_DELIVERY_FRAME
    : "";
  const composed = composeGroundedAnswer(question, kept, frame, synthesis.validation.evidenceCount);
  return {
    ...synthesis,
    ...composed,
    validation: {
      ...composed.validation,
      verifier: {
        status: "applied" as const,
        model: result.model,
        threshold: options.threshold,
        scores: result.verdicts.map((verdict) => verdict.score),
        unverifiedClaims,
      },
    },
  };
}
