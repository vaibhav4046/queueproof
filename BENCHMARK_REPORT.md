# QueueProof benchmark report

Generated: 2026-08-04T17:34:23.851Z
Runner: `node scripts/run-evals.mjs`
Fixtures: `evals/fixtures/cases.json` (39 ground truth cases, fictional company "Helios Robotics")

## What this report is

Two independent phases, never merged.

**Fixture phase** runs offline with no credentials. It exercises the real deterministic components
(`planRetrieval` from `packages/retrieval/src`, `rank` from `packages/ranking/src`, and
`rankingInputSchema` from `packages/contracts/src`) and measures only what those functions can
decide without data: the routing decision and the ranking order.

**Live phase** requires a reachable deployment with `data_verified` connectors. Everything that
depends on real retrieved content is measured there or not at all.

## Fixture results (offline, deterministic layer only)

Router mode accuracy: **39/39 = 100.0%**

Labelled coverage (overlapping dimensions): **16 multi-hop**, **7 temporal/update**, **6 contradiction/stale**, **5 entity-dedup**, **6 exact/metadata**, **9 document/PDF**.

This compares `planRetrieval(question).mode` against the hand-labelled `expected.mode` for each
case. The label was written from the question, not copied from the router, so a mismatch is a real
routing disagreement rather than a tautology.

| Category | Cases | Router mode correct | Accuracy |
| --- | ---: | ---: | ---: |
| exact-id | 3 | 3 | 100.0% |
| actor | 3 | 3 | 100.0% |
| thread | 2 | 2 | 100.0% |
| temporal | 3 | 3 | 100.0% |
| metadata | 3 | 3 | 100.0% |
| entity-dedup | 2 | 2 | 100.0% |
| knowledge-update | 2 | 2 | 100.0% |
| attribution | 3 | 3 | 100.0% |
| multilingual | 3 | 3 | 100.0% |
| multi-hop | 2 | 2 | 100.0% |
| conflict | 2 | 2 | 100.0% |
| priority | 3 | 3 | 100.0% |
| counterfactual | 2 | 2 | 100.0% |
| adversarial | 3 | 3 | 100.0% |
| large-pdf | 3 | 3 | 100.0% |
| **all** | **39** | **39** | **100.0%** |

### Routing behaviour

| Measure | Value |
| --- | ---: |
| Predicted fast / thinking | 14 / 25 |
| Expected fast / thinking | 14 / 25 |
| Escalations to thinking | 25 |
| Over escalated (expected fast, got thinking) | 0 |
| Under escalated (expected thinking, got fast) | 0 |

### Ranking

3 case(s) declare an expected top task. Each builds real `RankingInput`
objects, validates them against `rankingInputSchema`, and calls the real `rank()`.

- `prio-01`: expected `task-atlas-blocker`, got `task-atlas-blocker` — PASS (order: task-atlas-blocker=89.72, task-vega-polish=26.68)
- `prio-02`: expected `task-bug123-fix`, got `task-bug123-fix` — PASS (order: task-bug123-fix=81.67, task-nimbus-oncall=51.18, task-doc-refresh=14.81)
- `prio-03`: expected `task-northwind-sla`, got `task-northwind-sla` — PASS (order: task-northwind-sla=84.44, task-kestrel-contract=44.99, task-internal-tooling=27.92, task-vega-shipped=0)

### Provider availability

Fixture mode proves nothing about connectors, so unless `QUEUEPROOF_AVAILABLE_PROVIDERS` is set
explicitly the available set is empty and every case counts as unserviceable.

| Measure | Value |
| --- | ---: |
| Available providers | none |
| Cases with at least one unavailable provider | 39 of 39 |
| Cases blocked on `document` | 9 |
| Cases blocked on `gmail` | 11 |
| Cases blocked on `linear` | 24 |
| Cases blocked on `slack` | 16 |

### Fixture assertions

All 331 fixture-computable assertions passed.


## Live results

Live phase: NOT_REQUESTED.

Live evaluation runs only with --live. Fixture metrics below measure the deterministic layer only.

No live metric is estimated, interpolated or carried over from a previous run.

## Not measured (requires live connectors)

These are absent by design. No value is guessed for any of them.

| Metric | Status | Why |
| --- | --- | --- |
| Citation precision | not measured | Requires answers grounded in real indexed sources plus a human-labelled citation key. |
| Citation recall | not measured | Requires the full set of correct sources per question, which only exists once real data is indexed. |
| End to end latency | not measured | Requires a real /api/query round trip against a deployment with verified connectors. |
| HydraDB call count | not measured | Counted server side per query run; no query runs happen in fixture mode. |
| Cost per query | not measured | Derived from real provider and HydraDB usage; no billable call is made in fixture mode. |

## How to run the live phase

```bash
QUEUEPROOF_LIVE_TEST=true \
QUEUEPROOF_URL=https://your-deployment \
QUEUEPROOF_SESSION_COOKIE=... \
QUEUEPROOF_DATABASE=... \
node scripts/run-evals.mjs --live
```

Without all four, the live phase skips loudly and exits non-zero rather than reporting a number it
did not measure.

## Artifacts

- `evals/results/results.json` — full machine readable output, fixture and live kept separate
- `evals/results/results.csv` — one row per case

## Live connector run (strict grader; measured, not fixture)

Target https://queueproof.vercel.app. Connectors: github, gmail, linear, slack. Generated 2026-08-04T10:06:06.911Z. Grader: `grounded-grader-v2`.

| Case | Mode | Latency | Sources | Providers in evidence |
| --- | --- | --- | --- | --- |
| three-provider multi-hop | `thinking` | 14501 ms | 5 | github, linear, slack |
| deadline conflict | `thinking` | 29877 ms | 3 | linear, slack |
| untracked commitment | `thinking` | 16294 ms | 5 | github, gmail, linear, slack |
| stale tracked work | `thinking` | 17824 ms | 2 | github |
| actor reconstruction | `thinking` | 22022 ms | 9 | linear, slack |
| exact identifier plus context | `thinking` | 12310 ms | 1 | slack |

Latency across 6 live questions: p50 16294 ms, p95 29877 ms, min 12310 ms, max 29877 ms.

Questions whose evidence spanned all three connected providers: 2/6. Routed thinking/fast: 6/0.

Required-fact recall: 100.0%. Citation completeness: 100.0%. Unsupported-claim rate: 0.0%.

These are real end-to-end measurements against connected providers.
The sample is small and is not presented as a stable distribution.
