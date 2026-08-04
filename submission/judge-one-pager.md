# QueueProof judge one-pager

## One answer. Every system. Proven.

QueueProof uses HydraDB to turn fragmented work evidence into a cited answer and a
deterministic next-action packet. It closes the gap between retrieval and safe execution:

`verified evidence -> grounded claims -> deterministic priority -> approval-gated write`

## The demo in one question

> Who escalated the AuthShield outage, what did engineering commit to, and is the fix
> already merged?

The last production observation returned cited GitHub, Linear, and Slack evidence in one
thinking query. The answer exposed its receipt IDs, provider coverage, call count, elapsed
time, and a tracked-state disagreement. Open any citation to inspect the supporting
excerpt.

## Why HydraDB matters

- Four last-observed connectors were `data_verified`: GitHub, Gmail, Linear, and Slack.
- Verification requires a canary with source IDs attributable to connector/resource
  lineage; a saved credential is not enough.
- Exact identifiers run text and hybrid lanes concurrently, then merge and deduplicate.
- Documents and provider records participate in the same grounded evidence contract.

## Why the queue is defensible

Conflict-aware clustering avoids merging records with disjoint exact IDs. A pure,
versioned ranking policy produces the order. Each Execution Packet contains evidence,
score components, penalties, constraints, dependencies, acceptance criteria, missing
information, permissions, and a receipt hash.

## Why the write is safe

The public sandbox supports shared evidence and proposals but denies credentials,
connectors, uploads, token administration, and external execution. A private action still
requires the exact proposal, explicit approval, and a unique database execution claim
before the provider call.

## Reproducible evidence

| Evidence | Result |
| --- | ---: |
| Router fixtures | 39/39 |
| Fixture assertions | 331 |
| Full suite | 324 tests / 32 files |
| Security / MCP | 13 / 8 tests |
| Typecheck, lint, build, E2E, deploy check | pass |
| Responsive viewports | 7, from 360x800 to 3840x2160 |
| Secret scan | 0 matching files across pre-release history + release worktree |

## Honest boundary

The fresh strict 346-page baseline passed 20/22 cases and recovered 53/56 facts with
complete citations. It was measured against public production before the last unpublished
retrieval changes, so QueueProof does not call it 22/22 or a post-release result.

Live: <https://queueproof.vercel.app>

Method: [docs/EVALUATION_METHODOLOGY.md](../docs/EVALUATION_METHODOLOGY.md)

Demo: [docs/DEMO_SCRIPT_60S.md](../docs/DEMO_SCRIPT_60S.md)
