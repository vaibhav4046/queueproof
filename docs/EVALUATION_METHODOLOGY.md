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
count, weighted query units, and latency. Before any questions run, the runner captures
`/api/health/live` and requires the artifact's release receipt to match the intended commit.

The canonical Auto, forced Fast, and forced Thinking artifacts all bind to commit
`aed027879150e3e324b54c5ec2194d4d715c501e` on `main`, deployment
`queueproof-7hvdge426-vaibhav4046s-projects.vercel.app`. Their six-question results are:

| Requested mode | Cases | Facts | p50 / p95 | Calls / units | Returned mode |
| --- | ---: | ---: | ---: | ---: | --- |
| Auto | 4/6 | 19/19 | 2,155 / 2,392 ms | 7 / 7 | 6 Fast |
| Forced Fast | 4/6 | 19/19 | 1,833 / 2,446 ms | 7 / 7 | 6 Fast |
| Forced Thinking | 2/6 | 13/19 | 26,329 / 40,003 ms | 10 / 30 | 5 Thinking; 1 timeout/unknown |

The sample is small and is not an SLA. Mode comparison is descriptive: the final artifacts
do not support a Fast/Thinking parity claim.

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

The canonical live and PDF artifacts use `grounded-grader-v2`. Earlier retained artifacts
remain provenance only; their figures are not substituted into the final release-bound results.

## 4. Large-PDF suite

`evals/fixtures/large-pdf-facts.json` defines 22 questions and 56 required-fact groups.
Beginning, middle, and end canaries are keyed explicitly. The suite includes exact IDs,
superseded policy, tables, similar people, multilingual evidence, distractors, and a
document-plus-connectors join.

The release-bound public-production artifact in `evals/results/pdf-live-run.json` is 21/22
core cases and 55/56 required facts. It records 69 citations, 84/84 supported claims, perfect
citation precision/completeness, zero unsupported claims, and passing beginning/middle/end
canaries. All 22 core rows returned Fast. The measured p50/p95 was 1,823/2,382 ms, with
31 HydraDB calls and 31 weighted units.

The document-plus-connectors question is a separate extension, not a 23rd core pass. It
recovered 2/2 facts and cited the document plus GitHub, but remains `REVIEW` because only one
of the required two non-document providers was supported. Its receipt records 29,676 ms,
6 calls, and 18 weighted units. See `docs/LARGE_PDF_PROOF.md` for the remaining core miss and
full provenance.

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
pnpm benchmark:live -- --url https://queueproof.vercel.app --mode auto
pnpm benchmark:live -- --url https://queueproof.vercel.app --mode fast
pnpm benchmark:live -- --url https://queueproof.vercel.app --mode thinking
pnpm benchmark:pdf -- --url https://queueproof.vercel.app
```

Release gates independently verify typecheck, lint, the complete automated suite (including
security and MCP), production build, E2E, and deployment checks. Exact totals belong to the
CI receipt for the submitted commit.
