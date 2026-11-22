import { describe, expect, it, vi } from "vitest";
import { applyCitationVerifier, RERANKER_MAX_PAIRS, verifyClaims } from "../lib/server/citation-verifier";
import { rerankerConfig, validateRuntimeConfig } from "../lib/server/runtime-config";
import { synthesiseGroundedAnswer, type GroundedClaim, type SynthesisEvidence } from "../lib/server/synthesis";

const evidence: SynthesisEvidence[] = [
  {
    id: "linear-1",
    provider: "linear",
    title: "AuthShield authentication outage for Northwind",
    excerpt: "INC-2031: Northwind reported an authentication outage. Priya Raman filed this against Atlas Launch. Engineering committed to shipping the AuthShield fix before Friday 7 August 2026.",
  },
  {
    id: "slack-1",
    provider: "slack",
    title: "Northwind escalation",
    excerpt: "Northwind escalated the AuthShield authentication outage (INC-2031). Priya Raman filed BUG-123 against Atlas Launch.",
  },
  {
    id: "github-1",
    provider: "github",
    title: "AuthShield fix merged",
    excerpt: "The AuthShield authentication fix for INC-2031 was merged. Linear issue ENG-456 is still showing as open even though the code is shipped.",
  },
];
const QUESTION = "Who escalated the AuthShield outage, what did engineering commit to, and is the fix already merged?";
const URL_BASE = "http://127.0.0.1:8765";

type Pair = { claim: string; passage: string };
/** Fake sidecar: scores each pair with `score(pair)` and records every request body. */
const fakeSidecar = (score: (pair: Pair) => number) => {
  const requests: Pair[][] = [];
  const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const { pairs } = JSON.parse(String(init?.body)) as { pairs: Pair[] };
    requests.push(pairs);
    return new Response(JSON.stringify({ scores: pairs.map(score), model: "fake-cross-encoder", threshold: 0.5 }));
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, requests, spy: fetchImpl };
};

describe("citation verifier flag", () => {
  it("is off when QUEUEPROOF_RERANKER_URL is unset, so the route keeps the lexical synthesis", () => {
    expect(rerankerConfig({})).toBeNull();
    expect(rerankerConfig({ QUEUEPROOF_RERANKER_URL: "  " })).toBeNull();
    expect(validateRuntimeConfig({}).filter((issue) => issue.key.startsWith("QUEUEPROOF_RERANKER"))).toEqual([]);
  });

  it("defaults the threshold to 0.5 and accepts an explicit one", () => {
    expect(rerankerConfig({ QUEUEPROOF_RERANKER_URL: URL_BASE })).toEqual({ url: URL_BASE, threshold: 0.5 });
    expect(rerankerConfig({ QUEUEPROOF_RERANKER_URL: URL_BASE, QUEUEPROOF_RERANKER_THRESHOLD: "0.7" }))
      .toEqual({ url: URL_BASE, threshold: 0.7 });
  });

  it("rejects a non-http(s) or credentialed URL and an out-of-range threshold", () => {
    for (const bad of ["ftp://127.0.0.1:8765", "not a url", "http://user:pass@127.0.0.1:8765", "file:///etc/passwd"]) {
      expect(validateRuntimeConfig({ QUEUEPROOF_RERANKER_URL: bad }).map((issue) => issue.key))
        .toContain("QUEUEPROOF_RERANKER_URL");
      expect(rerankerConfig({ QUEUEPROOF_RERANKER_URL: bad })).toBeNull();
    }
    for (const bad of ["1.5", "-0.1", "abc"]) {
      expect(validateRuntimeConfig({ QUEUEPROOF_RERANKER_URL: URL_BASE, QUEUEPROOF_RERANKER_THRESHOLD: bad })
        .map((issue) => issue.key)).toContain("QUEUEPROOF_RERANKER_THRESHOLD");
    }
  });
});

describe("applyCitationVerifier", () => {
  const lexical = synthesiseGroundedAnswer(QUESTION, evidence);

  it("leaves answer, claims, and status unchanged when every claim clears the threshold", async () => {
    const sidecar = fakeSidecar(() => 0.9);
    const verified = await applyCitationVerifier(QUESTION, lexical, evidence, { url: URL_BASE, threshold: 0.5, fetchImpl: sidecar.fetchImpl });
    expect(verified.answer).toBe(lexical.answer);
    expect(verified.claims).toEqual(lexical.claims);
    expect(verified.missingInformation).toEqual(lexical.missingInformation);
    expect(verified.validation.status).toBe(lexical.validation.status);
    expect(verified.validation.verifier).toMatchObject({ status: "applied", model: "fake-cross-encoder", unverifiedClaims: [] });
    expect(sidecar.requests[0]).toContainEqual({ claim: lexical.claims[0].text, passage: `${evidence[0].title}. ${evidence[0].excerpt}` });
  });

  it("drops claims scored below threshold, lists them as unverified, and recomputes partial status", async () => {
    expect(lexical.validation.status).toBe("grounded");
    const sidecar = fakeSidecar((pair) => /merged/.test(pair.claim) ? 0.2 : 0.8);
    const verified = await applyCitationVerifier(QUESTION, lexical, evidence, { url: URL_BASE, threshold: 0.5, fetchImpl: sidecar.fetchImpl });
    expect(verified.claims.some((claim) => /merged/.test(claim.text))).toBe(false);
    expect(verified.answer).not.toMatch(/merged/);
    expect(verified.validation.verifier).toMatchObject({
      status: "applied",
      unverifiedClaims: [expect.objectContaining({ text: expect.stringMatching(/merged/), score: 0.2 })],
    });
    expect(verified.validation.status).toBe("partial");
    expect(verified.missingInformation).toEqual(expect.arrayContaining([expect.stringMatching(/completion state/i)]));
    expect(verified.contradictions).toEqual(lexical.contradictions);
  });

  it("abstains when no claim clears the threshold", async () => {
    const sidecar = fakeSidecar(() => 0.1);
    const verified = await applyCitationVerifier(QUESTION, lexical, evidence, { url: URL_BASE, threshold: 0.5, fetchImpl: sidecar.fetchImpl });
    expect(verified.claims).toEqual([]);
    expect(verified.validation.status).toBe("abstained");
    expect(verified.answer).toMatch(/^Insufficient evidence\./);
    expect(verified.missingInformation).toEqual(["No claim could be supported by the retrieved records."]);
  });

  it("treats a score exactly at threshold as supported", async () => {
    const result = await verifyClaims(lexical.claims, evidence, {
      url: URL_BASE, threshold: 0.5, fetchImpl: fakeSidecar(() => 0.5).fetchImpl,
    });
    expect(result.status === "applied" && result.verdicts.every((verdict) => verdict.supported)).toBe(true);
  });

  it("fails open with a visible unavailable status when the sidecar is down", async () => {
    const fetchImpl = vi.fn(async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch;
    const verified = await applyCitationVerifier(QUESTION, lexical, evidence, { url: URL_BASE, threshold: 0.5, fetchImpl });
    expect(verified.answer).toBe(lexical.answer);
    expect(verified.claims).toEqual(lexical.claims);
    expect(verified.validation.status).toBe(lexical.validation.status);
    expect(verified.validation.verifier).toEqual({ status: "unavailable", reason: "fetch failed", threshold: 0.5 });
  });

  it("fails open on HTTP errors and malformed score lists", async () => {
    const http500 = vi.fn(async () => new Response("boom", { status: 500 })) as unknown as typeof fetch;
    const shortList = vi.fn(async () => new Response(JSON.stringify({ scores: [0.9] }))) as unknown as typeof fetch;
    const outOfRange = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const { pairs } = JSON.parse(String(init?.body)) as { pairs: Pair[] };
      return new Response(JSON.stringify({ scores: pairs.map(() => 7) }));
    }) as unknown as typeof fetch;
    for (const fetchImpl of [http500, shortList, outOfRange]) {
      const result = await verifyClaims(lexical.claims, evidence, { url: URL_BASE, threshold: 0.5, fetchImpl });
      expect(result.status).toBe("unavailable");
    }
  });

  it("fails open when the sidecar exceeds the timeout", async () => {
    const hang = vi.fn((_url: unknown, init?: RequestInit) => new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
    })) as unknown as typeof fetch;
    const result = await verifyClaims(lexical.claims, evidence, { url: URL_BASE, threshold: 0.5, timeoutMs: 20, fetchImpl: hang });
    expect(result.status).toBe("unavailable");
  });
});

describe("verifyClaims batching and scoring", () => {
  it("scores a claim as the max over its cited evidence", async () => {
    const claim: GroundedClaim = { text: "Priya Raman filed BUG-123.", evidenceIds: ["linear-1", "slack-1"], providers: ["linear", "slack"] };
    const sidecar = fakeSidecar((pair) => pair.passage.startsWith("Northwind escalation") ? 0.8 : 0.3);
    const result = await verifyClaims([claim], evidence, { url: URL_BASE, threshold: 0.5, fetchImpl: sidecar.fetchImpl });
    expect(result).toEqual({ status: "applied", model: "fake-cross-encoder", verdicts: [{ supported: true, score: 0.8 }] });
  });

  it("splits more than 256 pairs into batches of at most 256 and posts to /score", async () => {
    const claims: GroundedClaim[] = Array.from({ length: 300 }, (_, index) => ({
      text: `claim ${index}`, evidenceIds: ["slack-1"], providers: ["slack"],
    }));
    const sidecar = fakeSidecar((pair) => pair.claim === "claim 299" ? 0.1 : 0.9);
    const result = await verifyClaims(claims, evidence, { url: URL_BASE, threshold: 0.5, fetchImpl: sidecar.fetchImpl });
    expect(sidecar.requests.map((pairs) => pairs.length)).toEqual([RERANKER_MAX_PAIRS, 300 - RERANKER_MAX_PAIRS]);
    expect(String(sidecar.spy.mock.calls[0][0])).toBe(`${URL_BASE}/score`);
    expect(result.status === "applied" && result.verdicts.filter((verdict) => !verdict.supported).length).toBe(1);
  });

  it("makes no request when there are no claims", async () => {
    const sidecar = fakeSidecar(() => 1);
    const result = await verifyClaims([], evidence, { url: URL_BASE, threshold: 0.5, fetchImpl: sidecar.fetchImpl });
    expect(result).toEqual({ status: "applied", model: "unknown", verdicts: [] });
    expect(sidecar.spy).not.toHaveBeenCalled();
  });
});
