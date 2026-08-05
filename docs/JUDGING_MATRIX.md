# HydraDB hackathon judging matrix

## Judge scorecard

| Criterion | Runtime-A evidence | Fast demo check |
| --- | --- | --- |
| Correctness and grounding | Auto and forced Fast recovered **19/19 required facts**; every strict miss remains a REVIEW instead of being rounded into a pass | Run the flagship question and open one numbered receipt |
| Cross-source reasoning | Four declared connectors; the flagship answer joins attributable GitHub, Linear, and Slack evidence and preserves disagreement | Point to provider coverage and the conflicting tracked state |
| Difficult retrieval | Identity matching, temporal ordering, actor attribution, exact IDs, changed state, contradiction handling, and large-document retrieval are frozen in the graders | Inspect the question, route reason, and missing-evidence state |
| Large-document ingestion | SHA-bound 346-page PDF: **21/22 cases, 55/56 facts, 84/84 claims supported, 69 citations**; beginning/middle/end canaries pass | Open the PDF result under **Proof tests** |
| Latency and cost | Auto: **2,155/2,392 ms p50/p95, 7 calls/7 units**. Fast: **1,833/2,446 ms, 7/7**. Thinking: **26,329/40,003 ms, 10/30, one timeout** | Compare modes without hiding the failed Thinking run |
| Reproducibility | Runtime SHA/ref embedded in every live artifact; router **39/39 cases, 331 assertions**; PDF fixture has 22 questions and 56 fact groups | Match the UI figures to `RELEASE_EVIDENCE.md` and JSON receipts |
| Security and trust | Security suite **14 tests**; evidence-first answers, explicit missing information, and approval-gated writes | Show the receipt and approval boundary |
| Developer experience and MCP | MCP suite **12 tests**; **Connect AI** exposes the bounded client configuration | Open **Connect AI** and show Codex/Claude setup |
| Engineering quality | Typecheck, lint, **39 files/364 tests**, two production build paths, built-app E2E, deploy bindings, and production identity all passed | Show the SHA-bound release receipt |

## Hackathon requirement compliance

| Requirement | Status | Evidence |
| --- | --- | --- |
| At least three working connectors | **PASS** | GitHub, Gmail, Linear, and Slack are identified in runtime-A receipts; the flagship uses three providers |
| Large-document ingestion | **PASS** | 346 pages, document SHA-256 and source ID, 22 questions, 56 fact groups, and page-range canaries |
| Difficult cross-source questions | **PASS** | Flagship GitHub + Linear + Slack investigation with preserved disagreement |
| Expected versus actual answers | **PASS** | Machine-readable rows retain expected facts, observed facts, strict status, citations, mode, calls, and latency |
| Fast versus Thinking evaluation | **PASS, WITH FAILURE VISIBLE** | Auto/Fast recovered 19/19 facts; forced Thinking recovered 13/19 and timed out once |
| Accuracy, latency, calls, mode, cost | **PASS** | All fields are retained in SHA-bound JSON artifacts |
| Reproducible release | **PASS FOR RUNTIME A** | Exact SHA/ref, immutable deployment, release gate, and commands are recorded |
| Public repository access | **PENDING** | Repository is currently **PRIVATE** |
| 60-second public video | **PENDING** | Record from the final public build, then add the URL |

## Release evidence

- Measured runtime A: `aed027879150e3e324b54c5ec2194d4d715c501e` on `main`.
- Immutable deployment:
  <https://queueproof-7hvdge426-vaibhav4046s-projects.vercel.app>.
- Canonical URL: <https://queueproof.vercel.app>.
- Evidence build B is the current `main` commit containing this receipt; verify its exact
  deployed SHA via `/api/health/live`. Unless B is deployed and rerun, the measurements
  continue to describe runtime A.
- Canonical receipt: [`RELEASE_EVIDENCE.md`](../RELEASE_EVIDENCE.md).

The exact runtime-A gate passed typecheck, lint, 39 files / 364 tests, 14 security tests,
12 MCP tests, 39/39 router cases with 331 assertions, Vinext and Next/Webpack production
builds, built-app E2E, deployment bindings, and production SHA/ref verification.

## Differentiator

Search products return snippets. QueueProof turns fragmented work into an inspectable decision:

`connected evidence -> supported claims -> preserved conflict -> next safe action -> approval`

The receipt is the product contract. It shows what supports the answer, what remains unknown,
which mode ran, what it cost in relative query units, and what permission is required before a
write.

## Honest limits judges can verify

- Auto and forced Fast passed 4/6 strict cases despite recovering 19/19 facts; strict provider
  and contradiction misses remain REVIEW.
- Forced Thinking passed 2/6, recovered 13/19 facts, and timed out once. This sample does not
  support a claim that Thinking improved quality.
- The PDF core passed 21/22 and 55/56. Its separate cross-source extension found 2/2 facts but
  failed the required provider threshold.
- The six-question runs are release diagnostics, not an SLA.
- Weighted units compare relative query cost and are not dollars.
- The repository is **PRIVATE** and the video is **PENDING** until those submission steps are
  completed.
