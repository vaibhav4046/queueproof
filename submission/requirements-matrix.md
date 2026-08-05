# Submission requirements matrix

Production measurements below belong to runtime
`aed027879150e3e324b54c5ec2194d4d715c501e` on `main`. The current main evidence build must
be committed, deployed, and verified through `/api/health/live`; its exact identity belongs in
`RELEASE_EVIDENCE.md`.

| Requirement | Evidence | Status |
| --- | --- | --- |
| Public product | <https://queueproof.vercel.app> | Live; verify final evidence-build SHA |
| At least three connectors | GitHub, Gmail, Linear, and Slack last showed verified canary state | Pass; refresh before recording |
| Cross-source answer | AuthShield receipt across GitHub, Linear, and Slack | Pass on measured runtime |
| Difficult questions | Temporal, actor, disagreement, stale-state, missing-tracking, and exact-ID cases | Measured; REVIEW retained |
| Fast versus Thinking | [Fast](../evals/results/live-fast.json) and [Thinking](../evals/results/live-thinking.json) | Fast 4/6 and 19/19; Thinking 2/6 and 13/19 with one timeout |
| Auto routing | [Auto](../evals/results/live-run.json) | 4/6, 19/19, all six resolved Fast |
| Latency, calls, and cost | Same machine-readable artifacts | p50/p95, calls, and relative units recorded |
| Expected versus observed | Per-case rows in the artifacts and Proof tests | Pass; failed requirements remain REVIEW |
| Large-document ingestion | [PDF artifact](../evals/results/pdf-live-run.json) | 346-page core: 21/22, 55/56, 69 citations, 84/84 supported claims |
| PDF position coverage | Beginning, middle, and end canaries | All passed |
| PDF cross-source extension | Document plus GitHub receipt | REVIEW; one non-document provider missing |
| Deterministic planner | `pnpm benchmark:router` | 39/39 labelled cases; 331 fixture assertions |
| MCP | Connect AI setup plus submitted-build MCP receipt | Final client receipt pending |
| Full release gates | `RELEASE_EVIDENCE.md` | Pending current main evidence-build receipt |
| Responsive and accessibility | Final-deployment viewport, zoom, keyboard, and reduced-motion receipt | Pending final capture |
| Repository | <https://github.com/vaibhav4046/queueproof> | **Pending: private** |
| Video | Canonical [demo script](../docs/DEMO_SCRIPT_60S.md) | **Pending: public URL** |
| Submission copy | [canonical copy](../docs/SUBMISSION_COPY.md) | Updated; final identity and links pending |

## Exact measured results

| Run | Cases | Facts | p50 / p95 | Calls / units | Notes |
| --- | ---: | ---: | ---: | ---: | --- |
| Best / Auto | 4/6 | 19/19 | 2,155 / 2,392 ms | 7 / 7 | All six Fast |
| Quick / Fast | 4/6 | 19/19 | 1,833 / 2,446 ms | 7 / 7 | Two provider-review rows |
| Investigate / Thinking | 2/6 | 13/19 | 26,329 / 40,003 ms | 10 / 30 | One timeout |
| PDF core | 21/22 | 55/56 | 1,823 / 2,382 ms | 31 / 31 | All 22 Fast; canaries passed |
| PDF cross-source extension | REVIEW | 2/2 | 29,676 ms | 6 / 18 | Document + GitHub; one provider missing |

## Before final submission

- Commit and deploy the current main evidence build, then record its health identity.
- Make the repository public and verify it in a signed-out browser.
- Add and verify the public video, LinkedIn, and X/Twitter URLs.
- Refresh connector canaries and complete the final responsive/accessibility receipt.
- Do not convert REVIEW into PASS or transfer runtime-A metrics to another runtime.
