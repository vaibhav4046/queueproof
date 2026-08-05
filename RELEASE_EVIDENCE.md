# QueueProof release evidence

> [!IMPORTANT]
> **Canonical judge-facing receipt.** The measurements in this document belong to deployed
> runtime A. Evidence build B packages the receipts and submission documents, but it does not
> retroactively change what was measured.

## Release identity

| Field | Value |
| --- | --- |
| Measured runtime A commit | `aed027879150e3e324b54c5ec2194d4d715c501e` |
| Measured runtime A ref | `main` |
| Immutable runtime A deployment | <https://queueproof-7hvdge426-vaibhav4046s-projects.vercel.app> |
| Canonical product URL | <https://queueproof.vercel.app> |
| Evidence build B identity | The current `main` commit containing this receipt; verify its exact deployed SHA via `/api/health/live` |
| Repository | <https://github.com/vaibhav4046/queueproof> — **PRIVATE** |
| Video | **PENDING** |

The checked-in live artifacts called `/api/health/live` before measuring and verified runtime
A's exact SHA, ref, and deployment. Evidence build B is the current `main` commit containing
this receipt; verify its exact deployed SHA via `/api/health/live`. B packages these receipts
and documents. Unless B is deployed and the measurements are rerun, every metric below
describes A, not B.

## Exact release gate

The final local release gate for runtime A passed:

| Gate | Result |
| --- | --- |
| Typecheck | **PASS** |
| Lint | **PASS** |
| Full automated suite | **PASS — 39 files, 364 tests** |
| Security suite | **PASS — 14 tests** |
| MCP suite | **PASS — 12 tests** |
| Deterministic router benchmark | **PASS — 39/39 cases, 331 assertions** |
| Vinext production build | **PASS** |
| Next/Webpack production build | **PASS** |
| Built-app end-to-end acceptance | **PASS** |
| Deployment-binding verification | **PASS** |
| Production identity | **PASS — runtime A SHA/ref matched** |
| Responsive and keyboard browser QA | **PASS — [production receipt](audit/UI_QA_2026-08-05.md)** |
| Production console check | **PASS — 0 warnings/errors observed** |

These are runtime-A release receipts, not evergreen totals. A later source change needs its own
gate and deployment receipt.

## SHA-bound measurement ledger

All live rows below target <https://queueproof.vercel.app> and embed runtime A's verified
release identity.

| Artifact | Strict result | Latency p50 / p95 | HydraDB calls / weighted units | Routing |
| --- | --- | --- | --- | --- |
| [`evals/results/live-run.json`](evals/results/live-run.json) | Auto: **4/6 cases; 19/19 required facts** | **2,155 / 2,392 ms** | **7 / 7** | **6/6 Fast** |
| [`evals/results/live-fast.json`](evals/results/live-fast.json) | Forced Fast: **4/6 cases; 19/19 required facts** | **1,833 / 2,446 ms** | **7 / 7** | **6/6 Fast** |
| [`evals/results/live-thinking.json`](evals/results/live-thinking.json) | Forced Thinking: **2/6 cases; 13/19 required facts; one timeout** | **26,329 / 40,003 ms** | **10 / 30** | Forced Thinking |
| [`evals/results/pdf-live-run.json`](evals/results/pdf-live-run.json) | 346-page PDF core: **21/22 cases; 55/56 facts; 84/84 claims supported** | **1,823 / 2,382 ms** | **31 / 31** | **22/22 Fast** |

The PDF core run contains **69 citations**, passed the beginning, middle, and end canaries, and
recorded the document SHA-256 and HydraDB source ID. Its separate cross-source extension found
**2/2 required facts** with document and GitHub evidence, but is correctly marked **REVIEW**
because it missed one additional required non-document provider. That extension took
**29,676 ms**, **6 calls**, and **18 weighted units**. It is not included in the PDF core
21/22 denominator.

The 4/6 live case score and the 19/19 fact score answer different questions. Both Auto and
forced Fast recovered every frozen fact, while two cases failed stricter provider or
contradiction requirements. Forced Thinking did not improve this sample and timed out once.
QueueProof keeps those failures visible.

The offline router result, connector live samples, and large-PDF run are separate measurements.
The six-question samples are release diagnostics, not an SLA. Weighted units are a relative
query-cost model, not dollars.

## Connector and developer evidence

- Runtime A's live receipts declare four connectors: GitHub, Gmail, Linear, and Slack.
- The flagship query requires and returns attributable GitHub, Linear, and Slack evidence.
- A connector counts as ready only after a provider canary returns attributable records; a
  saved credential alone is not proof.
- The MCP gate passed 12 tests. The product's **Connect AI** surface exposes the bounded MCP
  configuration for supported clients; external writes remain approval-gated.

## Claim rules

- `REVIEW` means a strict requirement failed, even when every requested fact was found.
- A citation must resolve to a retained receipt that supports the nearby claim.
- A fixture proves deterministic planning and ranking only, not live connector quality.
- A provider action is executed only when its response identifier is persisted.
- The repository is not public while its visibility is **PRIVATE**. Judges need explicit access
  or the repository must be made public before submission.
- The demo is not complete until a public video URL replaces **PENDING**.

## Final sign-off

| Sign-off | Evidence |
| --- | --- |
| Measured runtime A identity | **PASS** — `aed027879150e3e324b54c5ec2194d4d715c501e` on `main` |
| Runtime A immutable deployment | **PASS** — <https://queueproof-7hvdge426-vaibhav4046s-projects.vercel.app> |
| Runtime A exact release gate | **PASS** |
| Auto artifact | **PASS — SHA-bound** |
| Forced Fast artifact | **PASS — SHA-bound** |
| Forced Thinking artifact | **RECORDED WITH ONE TIMEOUT** |
| Large-PDF artifact | **PASS — SHA-bound; one core REVIEW and one cross-source REVIEW retained** |
| Evidence build B | Current `main` commit containing this receipt; verify its exact deployed SHA via `/api/health/live` |
| Repository access | **PRIVATE — judge access/public visibility still required** |
| Video URL | **PENDING** |
