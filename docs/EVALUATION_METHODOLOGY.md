# Evaluation methodology

QueueProof separates deterministic fixtures, live connector retrieval, mode comparison, and
large-document retrieval. Their results are never merged into one vanity score.

## 1. Offline router and ranking fixtures

`evals/fixtures/cases.json` contains labelled Helios Robotics questions spanning multi-hop
reasoning, temporal updates, contradictions, entity resolution, exact identifiers, metadata
filters, multilingual prompts, priority, and documents.

The fixture runner calls the production query planner, ranking function, and schemas directly.
It checks routing intent, exact-ID lanes, deterministic output, ranking order where labelled,
schema validity, and bounds.

This suite proves deterministic planner and ranking behavior only. It does not prove live
connector quality, grounded-answer accuracy, latency, or cost. The current result is whatever
the submitted commit produces with `pnpm benchmark:router`; exact totals belong to that run.

## 2. Live connector sample

The live runner sends frozen questions to the deployed workspace and records answer text,
claims, citations, provider coverage, selected mode, request IDs, HydraDB calls, weighted
query units, and end-to-end latency.

Before querying, the runner captures `/api/health/live`. An artifact is current only when its
verified release SHA equals the deployment SHA. `/api/lab` rejects bundled or persisted
artifacts for other releases and returns `awaiting_current_release_measurement` instead of
showing their numbers.

The live sample is a release diagnostic, not an SLA. Missing authorization, missing source
data, timeout, or a required-provider miss remains a named failure. Fixture values are never
substituted for unavailable live values.

## 3. Fast versus Thinking comparison

Fast and Thinking can be compared only when both artifacts:

- report `status: "measured"`;
- honor the requested mode;
- use the same target, fixture, and ordered case IDs; and
- identify the same deployed commit and ref.

Only then does `/api/lab` set `results.modeComparison.comparable` to `true` and calculate
deltas for pass count, fact accuracy, latency, calls, and weighted units. A partial,
incompatible, or older pair is not a comparison.

## 4. Strict grounded-answer grader

`evals/lib/grounded-grader.mjs` uses case-owned required facts rather than loose token overlap.
It checks:

- every required fact group;
- required providers backed by supporting citations;
- citation-ID resolution;
- claim text supported by the normalized cited excerpt;
- claim and citation provider agreement;
- citation precision and completeness;
- unsupported-claim rate; and
- two-provider cited support for required contradictions.

A provider label without a supporting cited claim does not count. A claim with an unresolved
or non-supporting receipt fails. `REVIEW` remains a failed strict case.

## 5. Large-PDF suite

`evals/fixtures/large-pdf-facts.json` defines 22 questions and 56 required-fact groups for a
deterministic 346-page document. It includes beginning, middle, and end canaries, exact IDs,
superseded policy, tables, close-name entities, multilingual evidence, distractors, and a
document-plus-connector extension.

The document-plus-connector extension is reported separately from the core denominator.
Large-PDF pass counts, fact recall, citations, latency, calls, and canary outcomes may be quoted
only when `/api/lab` reports a same-release PDF artifact with `status: "measured"`.

## Metrics

| Metric | Definition |
| --- | --- |
| Router agreement | Planned mode equals the human-authored expected mode |
| Strict case pass | Every fact, provider, citation, and contradiction requirement passes |
| Required-fact recall | Required fact groups present / required fact groups |
| Citation precision | Supported claim-citation pairs / all claim-citation pairs |
| Citation completeness | Claims with supporting citations / all claims |
| Unsupported-claim rate | Claims without supporting evidence / all claims |
| Provider coverage | Providers backed by supporting cited claims |
| Contradiction pass | Required disagreement backed by at least two cited providers |
| Latency | End-to-end time for one live request |
| Calls | HydraDB calls recorded in the receipt |
| Relative cost | Weighted query units; never presented as USD |

## Commands

```bash
pnpm benchmark:router
pnpm benchmark:live -- --url https://queueproof.vercel.app --mode auto
pnpm benchmark:live -- --url https://queueproof.vercel.app --mode fast
pnpm benchmark:live -- --url https://queueproof.vercel.app --mode thinking
pnpm benchmark:pdf -- --url https://queueproof.vercel.app
```

Release gates independently verify typecheck, lint, the complete automated suite, production
build, end-to-end behavior, and deployment bindings. Exact totals belong to the CI receipt for
the submitted commit.
