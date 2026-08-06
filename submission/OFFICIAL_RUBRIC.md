# HydraDB Connectors Hackathon rubric map

## Official sources

- [HydraDB Connectors Hackathon event page](https://luma.com/m84ocwqq)
- [HydraDB Query API: Fast, Thinking, actor/thread, and graph retrieval](https://docs.hydradb.com/essentials/v2/query)
- [HydraDB metadata filtering](https://docs.hydradb.com/essentials/v2/metadata)
- [HydraDB context graphs and multi-hop traversal](https://docs.hydradb.com/essentials/v2/context-graphs)
- [Official HydraDB MCP repository](https://github.com/usecortex/hydradb-mcp)
- [Official HydraDB CLI repository](https://github.com/usecortex/hydradb-cli)

The official event interval is July 31 at 6:00 PM PT through August 7 at 6:00 PM PT, which is
August 1 at 2:00 AM through August 8 at 2:00 AM in London daylight time. The organizer blast in
the supplied registration copy says the form closes Friday at 6:00 PM; because that blast is not
present in the accessible event-page body, use the official page's `PT` interval as the canonical
timezone rather than interpreting the blast's informal `PST` literally.

## Source and evidence rule

This map transcribes the official event page and organizer-provided event brief for the HydraDB Connectors Hackathon:
use at least three working connectors, ingest documents, answer difficult cross-source questions,
show expected versus actual results, compare latency and accuracy/cost across Fast and Thinking,
and provide a 60-second demo. The listed judging criteria are correctness, cross-source reasoning,
latency, cost, reproducibility, and developer experience.

No row is marked complete solely from source code. Current production proof must identify the exact
submitted SHA. `REVIEW` is a failure, a saved credential is not a working connector, relative query
units are not dollars, and an unrecorded video is not a submission.

## Official requirement matrix

| Official requirement | Product implementation | Source file | Test | Production proof | Submission field | Remaining deficiency |
| --- | --- | --- | --- | --- | --- | --- |
| At least 3 working connectors | HydraDB lifecycle plus attributable canary receipt; only `data_verified` sources enter retrieval | `lib/server/connector-proof.ts`, `packages/connectors/src/index.ts`, `lib/server/query-workflow.ts` | `tests/connector-proof.test.ts`, `tests/connector-lineage.test.ts`, `tests/readiness-truth.test.ts` | `/evidence` and `/api/connectors`; show at least three current ready rows with attributable records | “Connectors used” | Refresh at release; do not rely on a historical four-provider observation |
| Document ingestion | Owner-only upload, checksum/dedup, HydraDB source identity, status, and strict large-PDF runner | `app/api/documents/route.ts`, `lib/server/documents.ts`, `scripts/run-pdf-benchmark.mjs` | `tests/documents.test.ts`, `tests/large-pdf.test.ts` | Document receipt under `/evidence` plus same-SHA `results.pdf` in `/api/lab` | “Huge PDF/document ingestion” | Current-release PDF artifact must be measured and published |
| Difficult retrieval | Temporal, metadata, entity, actor, thread, multilingual, contradiction, exact-ID, recency, and multi-hop cases | `packages/retrieval/src/index.ts`, `lib/server/synthesis.ts`, `evals/fixtures/` | `tests/retrieval.test.ts`, `tests/synthesis.test.ts`, `tests/grounded-grader.test.ts` | Live question receipt and current-SHA benchmark rows | “Difficult questions” | Read strict current results; keep every failed provider/fact requirement visible |
| Same entities/events across sources | Source normalization, connector lineage, exact-ID lanes, conflict-aware clustering | `lib/server/hydradb-shapes.ts`, `packages/retrieval/src/index.ts`, `packages/graph/src/index.ts` | `tests/provider-alias.test.ts`, `tests/evidence-pairing.test.ts`, `tests/task-clustering.test.ts` | Flagship answer with citations from multiple current ready providers | Demo narration | A current live receipt must prove the providers actually returned evidence |
| Expected versus actual answers | Frozen case requirements and strict grounded grader retain actual answer, facts, citations, providers, failures, latency, calls, mode, release | `evals/fixtures/live-cases.json`, `evals/lib/grounded-grader.mjs`, `scripts/run-live-benchmark.mjs` | `tests/eval-fixtures.test.ts`, `tests/grounded-grader.test.ts`, `tests/benchmark-artifacts.test.ts` | `/api/lab` and `/benchmarks` rows for exact release | Benchmark/results section | Publish current artifacts with the dedicated benchmark credential |
| Fast and Thinking | Auto planner plus forced Fast/Thinking runners; comparison fails closed on different cases/releases | `packages/retrieval/src/index.ts`, `evals/lib/live-mode-comparison.mjs` | `tests/auto-routing.test.ts`, `tests/live-mode-comparison.test.ts` | `results.modeComparison.comparable: true` | Mode-comparison table | Do not quote a delta until the deployed pair is comparable |
| Accuracy, latency, calls, cost | Strict case/fact/citation metrics, end-to-end timing, HydraDB calls, weighted query units | `evals/lib/grounded-grader.mjs`, `scripts/run-live-benchmark.mjs`, `scripts/run-pdf-benchmark.mjs` | `tests/grounded-grader.test.ts`, `tests/evals.test.ts`, `tests/benchmark-artifacts.test.ts` | Same-SHA measured artifacts in `/api/lab` | Results and limitations | Current values pending; weighted units must not be converted to USD |
| 60-second demo | Live judge path from Ask to receipt, Sources, Proof tests, and Connect AI | `submission/VIDEO_SCRIPT_60_SECONDS.md`, `submission/VIDEO_SHOTLIST.md` | Manual preflight in `submission/DEMO_RUNBOOK.md` | Public production recording with no secret exposure | Video URL | Owner must record, upload, and verify public playback |

## Official judging criteria

| Criterion | Exact evidence to inspect | Current release gate |
| --- | --- | --- |
| Correctness | Strict case status, required-fact recall, claim support, citation resolution, missing proof | Same-SHA live and PDF artifacts measured; failures visible |
| Cross-source reasoning | Flagship cited answer, required-provider checks, contradiction receipt, document-plus-connector extension | Current connectors ready and current live receipt cites the required providers |
| Latency | Per-case and p50/p95 end-to-end times | Read from current artifacts only; no SLA language |
| Cost/efficiency | HydraDB call count, mode, weighted query units | Report units as relative work, never dollars |
| Reproducibility | Health SHA/ref/deployment plus lab SHA/ref, frozen cases, public commands | Exact submitted SHA deployed; current receipts published |
| Developer experience | Web/API/MCP parity, CLI verifier, schemas, errors, docs, approval boundary | Authenticated production MCP smoke test only if claimed |

## Supplementary engineering review panel

Scores remain **pending/10** until the final deployment and receipts exist. This prevents the
implementation team from awarding unsupported scores. Fill each score from the final product,
not an older artifact.

| Category | Score | Exact evidence | Strongest aspect | Main deduction | Exact correction | Release blocking? |
| --- | ---: | --- | --- | --- | --- | --- |
| Correctness | pending/10 | Current `/api/lab` strict rows | Claim-level grader and abstention | Current results may be unpublished | Measure/publish same-SHA runs | Yes |
| Cross-source reasoning | pending/10 | Flagship receipt and provider requirements | Preserved disagreement and exact-ID lanes | Connector availability is runtime-dependent | Refresh canaries and rerun | Yes |
| HydraDB usage | pending/10 | Connector IDs, source lineage, request IDs, PDF source ID | HydraDB is the retrieval and ingestion layer | Saved credentials alone prove nothing | Show attributable current receipts | Yes |
| Technical depth | pending/10 | Retrieval, ranking, packet, audit, approval code/tests | Evidence-to-action architecture | A score without live parity would be speculative | Review deployed flow end to end | No |
| Daily usefulness | pending/10 | Ask, Today, receipt, and packet flow | One answer to a next-action brief | Judge path must be rehearsed live | Complete runbook rehearsal | Yes |
| MCP interoperability | pending/10 | `initialize`, `tools/list`, read-only tool receipt | Same workspace contract over HTTP MCP | Authenticated production token/call may be pending | Record a safe smoke test | Only if claimed |
| Developer experience | pending/10 | README, CLI, config tests, setup docs | Reproducible commands and explicit status language | Named clients unverified until connected | Run client-specific discovery | No |
| Latency | pending/10 | Current p50/p95 and case rows | Per-mode observable timing | Small sample is not an SLA | Report scope and failures | Yes |
| Cost/efficiency | pending/10 | Calls and weighted units per mode | Fast/Thinking work is measurable | No verified USD conversion | Keep units relative | Yes |
| Reproducibility | pending/10 | Health/lab identity, frozen fixtures, commands | Release-bound artifact acceptance | Any SHA mismatch invalidates values | Verify/publish exact SHA | Yes |
| Interface quality | pending/10 | Desktop/mobile production walkthrough | Receipt-first judge path | Must inspect final deployment console/network | Run shot-list preflight | Yes |
| Accessibility | pending/10 | Keyboard, focus, reduced motion, zoom checks | Dialog focus and reduced-motion support | Manual final matrix may be pending | Execute runbook matrix | Yes |
| Security | pending/10 | Authz, MCP, SSRF, secret-scan and action tests | Server-side owner/approval boundary | Leaked external credentials still require rotation | Revoke/rotate and rescan | Yes if exposed |
| Demo reliability | pending/10 | Timed rehearsal and backup receipts | Metric-free script survives value changes | Recording/upload is manual | Rehearse, record, verify URL | Yes |

## Final rubric sign-off

Before submission, replace every `pending/10` with an evidence-backed score, add the exact receipt
link or identifier used, and leave genuine deductions in place. A release can satisfy the official
requirements while still showing imperfect measured cases; honesty and reproducibility are part of
the judging story.
