# QueueProof benchmark report

Generated: 2026-08-02T17:48:26.690Z
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

Router mode accuracy: **29/39 = 74.4%**

This compares `planRetrieval(question).mode` against the hand-labelled `expected.mode` for each
case. The label was written from the question, not copied from the router, so a mismatch is a real
routing disagreement rather than a tautology.

| Category | Cases | Router mode correct | Accuracy |
| --- | ---: | ---: | ---: |
| exact-id | 3 | 2 | 66.7% |
| actor | 3 | 3 | 100.0% |
| thread | 2 | 2 | 100.0% |
| temporal | 3 | 3 | 100.0% |
| metadata | 3 | 1 | 33.3% |
| entity-dedup | 2 | 0 | 0.0% |
| knowledge-update | 2 | 1 | 50.0% |
| attribution | 3 | 2 | 66.7% |
| multilingual | 3 | 2 | 66.7% |
| multi-hop | 2 | 2 | 100.0% |
| conflict | 2 | 2 | 100.0% |
| priority | 3 | 1 | 33.3% |
| counterfactual | 2 | 2 | 100.0% |
| adversarial | 3 | 3 | 100.0% |
| large-pdf | 3 | 3 | 100.0% |
| **all** | **39** | **29** | **74.4%** |

### Routing behaviour

| Measure | Value |
| --- | ---: |
| Predicted fast / thinking | 18 / 21 |
| Expected fast / thinking | 14 / 25 |
| Escalations to thinking | 21 |
| Over escalated (expected fast, got thinking) | 3 |
| Under escalated (expected thinking, got fast) | 7 |

### Ranking

3 case(s) declare an expected top task. Each builds real `RankingInput`
objects, validates them against `rankingInputSchema`, and calls the real `rank()`.

- `prio-01`: expected `task-atlas-blocker`, got `task-atlas-blocker` — PASS (order: task-atlas-blocker=82, task-vega-polish=23)
- `prio-02`: expected `task-bug123-fix`, got `task-bug123-fix` — PASS (order: task-bug123-fix=73, task-nimbus-oncall=46, task-doc-refresh=13)
- `prio-03`: expected `task-northwind-sla`, got `task-northwind-sla` — PASS (order: task-northwind-sla=72, task-kestrel-contract=38, task-internal-tooling=24, task-vega-shipped=0)

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

All 325 fixture-computable assertions passed.


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

## Live connector run (measured, not fixture)

Target https://queueproof.vercel.app. Connectors: linear, slack, github. Generated 2026-08-02T17:46:17.278Z.

| Case | Mode | Latency | Sources | Providers in evidence |
| --- | --- | --- | --- | --- |
| three-provider multi-hop | `thinking` | 6347 ms | 12 | github, linear, slack |
| exact identifier | `thinking` | 1454 ms | 12 | github, linear, slack |
| conflict | `thinking` | 5423 ms | 13 | github, linear, slack |
| untracked commitment | `fast` | 1123 ms | 12 | github, linear, slack |
| stale work | `fast` | 990 ms | 12 | github, linear, slack |
| actor + thread | `thinking` | 4401 ms | 12 | github, linear, slack |

Latency across 6 live questions: p50 4401 ms, p95 6347 ms, min 990 ms, max 6347 ms.

Questions whose evidence spanned all three connected providers: 6/6. Routed thinking/fast: 4/2.

These are real end-to-end measurements against connected Slack, Linear and GitHub.
The sample is small and is not presented as a stable distribution.
