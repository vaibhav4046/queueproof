# QueueProof benchmark report

> This file proves the deterministic fixture run in this working tree. Any live artifact
> appended below is pinned to its own deployment SHA and is historical unless that SHA matches
> the running production release. The canonical current-release view is `/benchmarks`.

Generated: 2026-08-08T03:06:32.963Z
Runner: `node scripts/run-evals.mjs`
Fixtures: `evals/fixtures/cases.json` (42 ground truth cases, fictional company "Helios Robotics")

## What this report is

Two independent phases, never merged.

**Fixture phase** runs offline with no credentials. It exercises the real deterministic components
(`planRetrieval` from `packages/retrieval/src`, `rank` from `packages/ranking/src`, and
`rankingInputSchema` from `packages/contracts/src`) and measures only what those functions can
decide without data: the routing decision and the ranking order.

**Live phase** requires a reachable deployment with `data_verified` connectors. Everything that
depends on real retrieved content is measured there or not at all.

## Fixture results (offline, deterministic layer only)

Router mode accuracy: **42/42 = 100.0%**

Labelled coverage (overlapping dimensions): **16 multi-hop**, **10 temporal/update**, **6 contradiction/stale**, **5 entity-dedup**, **6 exact/metadata**, **9 document/PDF**.

This compares `planRetrieval(question).mode` against the hand-labelled `expected.mode` for each
case. The label was written from the question, not copied from the router, so a mismatch is a real
routing disagreement rather than a tautology.

| Category | Cases | Router mode correct | Accuracy |
| --- | ---: | ---: | ---: |
| exact-id | 3 | 3 | 100.0% |
| actor | 3 | 3 | 100.0% |
| thread | 2 | 2 | 100.0% |
| temporal | 6 | 6 | 100.0% |
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
| **all** | **42** | **42** | **100.0%** |

### Routing behaviour

| Measure | Value |
| --- | ---: |
| Predicted fast / thinking | 14 / 28 |
| Expected fast / thinking | 14 / 28 |
| Escalations to thinking | 28 |
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
| Cases with at least one unavailable provider | 42 of 42 |
| Cases blocked on `document` | 9 |
| Cases blocked on `github` | 1 |
| Cases blocked on `gmail` | 11 |
| Cases blocked on `linear` | 26 |
| Cases blocked on `slack` | 17 |

### Fixture assertions

All 353 fixture-computable assertions passed.


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

## Historical live connector artifact (strict grader; release-pinned)

Target https://queueproof.vercel.app. Connectors: github, linear, slack. Generated 2026-08-07T19:30:11.627Z. Release: `dd0a52146cadba5c3ed128b9e5d0f7152bef0322`. Grader: `grounded-grader-v3`.

| Case | Mode | Latency | Sources | Providers in evidence |
| --- | --- | --- | --- | --- |
| three-provider multi-hop | `fast` | 6857 ms | 4 | github, linear, slack |
| deadline conflict | `fast` | 1747 ms | 2 | linear, slack |
| untracked commitment | `fast` | 2262 ms | 2 | github, slack |
| cross-source commitment confirmation | `fast` | 3447 ms | 4 | github, linear, slack |
| actor reconstruction | `fast` | 2874 ms | 2 | linear, slack |
| exact identifier plus context | `fast` | 4340 ms | 3 | linear, slack |
| most recent shipped item | `fast` | 3350 ms | 1 | github |
| post-mortem attribution cross-check | `fast` | 2237 ms | 2 | github, slack |

Latency across 8 live questions: p50 2874 ms, p95 6857 ms, min 1747 ms, max 6857 ms.

Questions whose evidence spanned all three connected providers: 2/8. Routed thinking/fast: 0/8.

Required-fact recall: 100.0%. Citation completeness: 100.0%. Unsupported-claim rate: 0.0%.

These are real end-to-end measurements against the release SHA printed above.
They are not a current-candidate score unless that SHA matches production.
The sample is small and is not presented as a stable distribution.
