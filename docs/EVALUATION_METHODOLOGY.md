# Evaluation methodology

QueueProof separates deterministic fixture checks, live connector checks, and large-PDF
checks. Their results are never merged into one vanity score.

## 1. Offline router and ranking fixtures

`evals/fixtures/cases.json` contains 39 labelled Helios Robotics questions across 15
categories. Dimensions overlap: multi-hop reasoning, temporal updates, contradictions,
entity resolution, exact identifiers, metadata filters, multilingual prompts, priority,
and documents.

The fixture runner calls the production `planRetrieval`, ranking function, and Zod
contracts directly. It verifies mode, category behavior, exact-ID dual-lane intent,
ranking order where labelled, deterministic output, schema validity, and bounds.

Current verified result: **39/39 router cases and 331 fixture-computable assertions**.
This proves deterministic planner/ranking behavior only. It proves nothing about a live
connector, answer quality, latency, or cost.

## 2. Live connector sample

The live runner sends stable questions to a deployment with verified connectors and
records answer text, claims, citations, provider coverage, mode, request IDs, HydraDB call
count, and latency. The stored six-question sample in `BENCHMARK_REPORT.md` is historical
and small; it is not an SLA.

No fixture metric is substituted when a live dependency is unavailable. Missing live
authorization or source data produces a named skip/failure.

## 3. Strict grounded-answer grader

`evals/lib/grounded-grader.mjs` uses explicit, case-owned required facts rather than loose
token overlap. It checks:

- all required fact groups;
- required providers supported by citations;
- citation-ID resolution;
- claim text contained by the cited excerpt after normalization;
- claim/citation provider agreement;
- citation precision and completeness;
- unsupported-claim rate;
- two-provider cited support for required contradictions.

A reported provider that lacks a supporting cited claim is exposed separately. A claim
with a citation label but no resolved, supporting receipt fails.

The current artifact contract is `grounded-grader-v2`. Earlier live evidence is labelled
`legacy-required-signal-v1`; the retained PDF evidence is labelled
`legacy-token-recall-v1`. Legacy artifacts prove that a run occurred, but their quality
figures are never promoted into current strict results.

## 4. Large-PDF suite

`evals/fixtures/large-pdf-facts.json` defines 22 questions and 56 required-fact groups.
Beginning, middle, and end canaries are keyed explicitly. The suite includes exact IDs,
superseded policy, tables, similar people, multilingual evidence, distractors, and a
document-plus-connectors join.

The final post-deploy public-production artifact in `evals/results/pdf-live-run.json` is
20/22 cases and 53/56 facts, with perfect citation precision/completeness and zero
unsupported claims. See `docs/LARGE_PDF_PROOF.md` for the misses and provenance.

## Metrics

| Metric | Definition |
| --- | --- |
| Router agreement | Planned mode equals the human-authored expected mode |
| Required-fact recall | Required fact groups present / required fact groups |
| Citation precision | Supported claim-citation pairs / all claim-citation pairs |
| Citation completeness | Claims with at least one supporting citation / all claims |
| Unsupported-claim rate | Claims without supporting evidence / all claims |
| Provider coverage | Providers backed by supporting cited claims |
| Contradiction pass | Required disagreement backed by at least two cited providers |
| Latency | End-to-end request time for a live query |
| Calls | Actual HydraDB calls recorded in the receipt |
| Relative cost | Weighted query units; never presented as invented USD spend |

## Commands

```bash
pnpm benchmark:router
pnpm benchmark:live -- --url https://queueproof.vercel.app
pnpm benchmark:pdf -- --url https://queueproof.vercel.app
```

Release gates independently verify typecheck, lint, the complete automated suite (including
security and MCP), production build, E2E, and deployment checks. Exact totals belong to the
CI receipt for the submitted commit.
