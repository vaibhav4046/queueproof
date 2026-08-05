# QueueProof judge one-pager

> [!IMPORTANT]
> Production metrics were measured on runtime
> `aed027879150e3e324b54c5ec2194d4d715c501e`. The forthcoming package is the current main
> evidence build; verify its exact identity through `/api/health/live`. Repository publication
> and the video URL remain pending.

## Ask your work. Get the proof.

QueueProof uses HydraDB to turn fragmented work evidence into one cited answer and one
evidence-backed Task brief:

`verified evidence -> grounded claims -> deterministic priority -> approval-gated proposal`

## The demo in one question

> Who escalated the AuthShield outage, what did engineering commit to, and is the fix already
> merged?

Run it in **Quick**. The answer exposes provider coverage, HydraDB calls, elapsed time,
numbered receipts, and any tracked-state disagreement. Open a citation to inspect its source
excerpt, provider, identifier, and timestamp.

## Why HydraDB matters

- The public workspace last showed four verified sources: GitHub, Gmail, Linear, and Slack.
- Verification requires attributable connector/resource lineage, not a saved credential.
- Exact identifiers use text and hybrid retrieval lanes before deduplication.
- Provider records and a 346-page document participate in the same receipt contract.

## Why the Task brief is defensible

Conflict-aware clustering avoids merging records with disjoint IDs. A versioned ranking policy
produces the order. Each Task brief includes evidence, score components, penalties,
constraints, dependencies, acceptance criteria, missing information, permissions, and a
receipt hash.

## Why external action is safe

The public workspace can prepare a proposal but cannot change credentials, control
connectors, mint MCP tokens, approve, or execute. A private action requires the exact proposal,
explicit approval, and one uniquely claimed execution row before provider I/O.

## Measured runtime evidence

| Run | Strict cases | Facts | p50 / p95 | Calls / units |
| --- | ---: | ---: | ---: | ---: |
| Best / Auto | 4/6 | 19/19 | 2,155 / 2,392 ms | 7 / 7 |
| Quick / Fast | 4/6 | 19/19 | 1,833 / 2,446 ms | 7 / 7 |
| Investigate / Thinking | 2/6 | 13/19 | 26,329 / 40,003 ms | 10 / 30 |
| 346-page PDF core | 21/22 | 55/56 | 1,823 / 2,382 ms | 31 / 31 |

The Thinking run had one timeout. PDF core questions all resolved as Fast; beginning, middle,
and end canaries passed, 84/84 claims were supported, and 69 citations resolved. The separate
PDF cross-source extension remains REVIEW: 2/2 facts, document plus GitHub, one additional
non-document provider missing, 29,676 ms, 6 calls / 18 units.

The six-query benchmark is not an SLA. REVIEW means the frozen requirement failed.

## Reproducibility boundary

- Runtime measured: `aed027879150e3e324b54c5ec2194d4d715c501e`.
- Evidence build: current main; exact SHA pending commit and `/api/health/live` verification.
- Router fixture: 39/39 labelled cases and 331 deterministic assertions; not live accuracy.
- Submitted-build CI, security, MCP, build, E2E, deployment, responsive, and secret-scan
  receipts must come from `RELEASE_EVIDENCE.md`.
- Repository: currently private. Video: pending.

Live: <https://queueproof.vercel.app>

Method: [docs/EVALUATION_METHODOLOGY.md](../docs/EVALUATION_METHODOLOGY.md)

Demo: [docs/DEMO_SCRIPT_60S.md](../docs/DEMO_SCRIPT_60S.md)
