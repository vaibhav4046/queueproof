# QueueProof benchmark report

Generated: 2026-08-05T21:51:00.000Z
Runner: `node scripts/run-evals.mjs`
Fixtures: `evals/fixtures/cases.json` (42 ground truth cases, fictional company "Helios Robotics"); `evals/fixtures/live-cases.json` (8 live synthesis cases)

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
| Cases blocked on `gmail` | 11 |
| Cases blocked on `linear` | 26 |
| Cases blocked on `slack` | 17 |

### Fixture assertions

All fixture-computable assertions passed (42 offline + 8 live structural = 54 total).


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

## SHA-bound live connector runs (strict grader; measured, not fixture)

The live fixture corpus now contains 8 cases (6 original + 2 recency cases). The two new recency cases
(`live-recency-most-recent-ship`, `live-recency-vs-tracked`) require the recency routing and synthesis
fix from `f5fe0e1`, which is not yet deployed. A fresh live run is needed after deployment to score the full corpus.

All three artifacts verified `/api/health/live` before running and bind to:

- commit: `aed027879150e3e324b54c5ec2194d4d715c501e`;
- ref: `main`;
- production deployment: `queueproof-7hvdge426-vaibhav4046s-projects.vercel.app`;
- canonical target: <https://queueproof.vercel.app>;
- grader: `grounded-grader-v2`; and
- connectors cited across Auto: GitHub, Gmail, Linear, and Slack.

| Requested mode | Passed | Required facts | p50 / p95 | Calls | Weighted units | Returned modes |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Auto (`live-run.json`) | 4/6 | 19/19 | 2,155 / 2,392 ms | 7 | 7 | 6 Fast |
| Forced Fast (`live-fast.json`) | 4/6 | 19/19 | 1,833 / 2,446 ms | 7 | 7 | 6 Fast |
| Forced Thinking (`live-thinking.json`) | 2/6 | 13/19 | 26,329 / 40,003 ms | 10 | 30 | 5 Thinking, 1 timeout/unknown |

Auto and forced Fast both measured 100% citation precision, 100% citation completeness,
and 0% unsupported claims. This is not Fast/Thinking parity: forced Thinking passed only 2/6,
recovered 13/19 facts, and one request timed out before returning a mode or answer.

### Auto case receipts

| Case | Result | Returned mode | Latency | Calls / units | Sources | Cited providers |
| --- | --- | --- | ---: | ---: | ---: | --- |
| three-provider multi-hop | PASS | `fast` | 2,155 ms | 1 / 1 | 6 | github, linear, slack |
| deadline conflict | PASS | `fast` | 2,173 ms | 1 / 1 | 3 | gmail, linear, slack |
| untracked commitment | PASS | `fast` | 2,007 ms | 1 / 1 | 3 | github, linear, slack |
| stale tracked work | REVIEW | `fast` | 2,277 ms | 1 / 1 | 2 | github |
| actor reconstruction | PASS | `fast` | 2,392 ms | 1 / 1 | 2 | linear, slack |
| exact identifier plus context | REVIEW | `fast` | 2,121 ms | 2 / 2 | 1 | slack |

Both Auto `REVIEW` rows contained every labelled answer fact. They failed the strict provider
contract because no supporting Linear citation was returned. A `REVIEW` is a failure; fact
coverage does not override missing required-provider evidence.

### Forced Thinking failures

- `deadline conflict` returned HTTP 200 but no supported answer facts or cited providers.
- `untracked commitment` timed out at 40,003 ms; mode is recorded as `unknown`, with zero
  completed HydraDB calls and no weighted cost asserted for that row.
- `stale tracked work` and `exact identifier plus context` recovered their required facts but
  still failed the required-provider contract.

These are six observed production questions, not an SLA or a universal accuracy claim.

## SHA-bound large-PDF run

`evals/results/pdf-live-run.json` verified the same release before running the deterministic
346-page handbook suite:

- core cases: **21/22**;
- required facts: **55/56**;
- latency p50/p95: **1,823/2,382 ms**;
- HydraDB calls / weighted units: **31/31**;
- returned mode: **Fast for all 22 core cases**;
- citations: **69**;
- supported claims: **84/84**;
- citation precision/completeness: **100% / 100%**;
- unsupported-claim rate: **0%**; and
- beginning, middle, and end canaries: **PASS**.

The remaining core `REVIEW` is `fact-superseded-policy`: it matched 4/5 required facts and
missed the grader's explicit “permission is no longer in force” phrase group. It remains a
failure in the artifact.

The document-plus-connectors extension is recorded separately from the 22 core cases. It
recovered 2/2 facts and cited `document` plus `github`, but remained `REVIEW` because the
contract required two non-document providers and only one was supported. It measured 29,676 ms,
6 HydraDB calls, and 18 weighted units.
