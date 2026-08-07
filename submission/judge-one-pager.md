# QueueProof judge one-pager

> [!IMPORTANT]
> The final production metrics must be read from `/benchmarks` only after `/api/health/live`
> reports the submitted commit. Never transfer a latency, pass count, or accuracy result from an
> earlier SHA. Repository publication and the video URL remain pending until the final release.

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

- The release gate requires at least three `data_verified` connectors and one indexed document in
  the submitted public workspace.
- Verification requires attributable connector/resource lineage, not a saved credential.
- Exact identifiers use text and hybrid retrieval lanes before deduplication.
- Provider records and a 346-page document participate in the same receipt contract.

## Why the Task brief is defensible

Conflict-aware clustering avoids merging records with disjoint IDs. A versioned ranking policy
produces the order. Each Task brief includes evidence, score components, penalties,
constraints, dependencies, acceptance criteria, missing information, permissions, and a
receipt hash.

## Why external action is safe

A signed-in workspace owner can prepare a proposal. The public workspace cannot read proposal
history, prepare or approve a change, change credentials, control connectors, mint MCP tokens, or
execute. A private action requires the exact proposal, explicit approval, and one uniquely claimed
execution row before provider I/O.

## Measured runtime evidence

Use the values rendered on `/benchmarks` for the exact submitted SHA:

| Run | Strict cases | Facts | p50 / p95 | Calls / units |
| --- | ---: | ---: | ---: | ---: |
| Best / Auto | current release only | current release only | current release only | current release only |
| Quick / Fast | current release only | current release only | current release only | current release only |
| Investigate / Thinking | current release only | current release only | current release only | current release only |
| 346-page PDF core | current release only | current release only | current release only | current release only |

The benchmark sample is not an SLA. `REVIEW` means the frozen requirement failed and must remain
visible. Quote a Fast/Thinking delta only when the page reports the pair as comparable.

## Reproducibility boundary

- Runtime measured: exact submitted SHA shown by `/api/health/live` and `/benchmarks`.
- Evidence build: current main; exact SHA pending final commit, deployment, and verification.
- Router fixture: 39/39 labelled cases and 331 deterministic assertions; not live accuracy.
- Submitted-build CI, security, MCP, build, E2E, deployment, responsive, and secret-scan
  receipts must come from `RELEASE_EVIDENCE.md`.
- Repository: currently private. Video: pending.

Live: <https://queueproof.vercel.app>

Method: [docs/EVALUATION_METHODOLOGY.md](../docs/EVALUATION_METHODOLOGY.md)

Demo: [docs/DEMO_SCRIPT_60S.md](../docs/DEMO_SCRIPT_60S.md)
