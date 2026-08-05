# HydraDB hackathon judging matrix

## Judge scorecard

| Criterion | Evidence in the product | Fast judge check |
| --- | --- | --- |
| Correctness and grounding | Claim-level citations resolve to retained receipts; missing requirements remain `REVIEW` | Run the flagship question and open one numbered receipt |
| Cross-source reasoning | The flagship answer joins GitHub, Linear, and Slack evidence while preserving conflicting states | Inspect provider coverage and the cited disagreement |
| Difficult retrieval | Frozen cases cover exact IDs, actors, time, changed state, contradictions, multilingual context, and multi-hop joins | Inspect a row's requirements and grounded result |
| Large-document ingestion | A 346-page document retains checksum, page count, HydraDB source ID, canaries, and a strict labelled suite | Open the PDF result under **Proof tests** |
| Latency and cost | Same-release artifacts retain latency, HydraDB calls, and weighted units per mode | Read exact current values from **Proof tests** |
| Reproducibility | Health identifies the running SHA; `/api/lab` publishes only matching release artifacts | Match the SHA in both endpoints |
| Security and trust | Public reads expose evidence; credentials, proposals, approvals, tokens, and writes are owner-only | Open a receipt, then inspect the approval boundary |
| Developer experience and MCP | **Connect AI** exposes MCP resource metadata and client configuration | Inspect the endpoint and auth instructions |
| Engineering quality | CI runs typecheck, lint, tests, router benchmark, build, and deployment checks | Open the submitted commit's CI receipt |

## Hackathon requirement compliance

| Requirement | Status | Acceptance evidence |
| --- | --- | --- |
| At least three working connectors | **VERIFY LIVE** | At least three Sources cards are ready with attributable records; degraded entries do not count |
| Large-document ingestion | **IMPLEMENTED; VERIFY CURRENT RESULT** | 346-page document provenance plus a measured same-release PDF artifact |
| Difficult cross-source questions | **IMPLEMENTED** | Flagship GitHub + Linear + Slack investigation with cited disagreement |
| Expected versus actual answers | **IMPLEMENTED** | Machine-readable rows retain requirements, observed facts, status, citations, mode, calls, and latency |
| Fast versus Thinking evaluation | **VERIFY COMPARABLE** | `/api/lab.results.modeComparison.comparable` is `true` for the submitted release |
| Accuracy, latency, calls, mode, cost | **IMPLEMENTED** | Same-release measured artifacts expose each field; units are not dollars |
| Reproducible release | **VERIFY SHA** | `/api/health/live` and `/api/lab` identify the same production commit |
| Public repository access | **PENDING** | Signed-out browser must open the repository |
| 60-second public video | **PENDING** | Upload the final current-release recording and add its URL |

## Release evidence rule

The only current release identity is the value returned by
[`/api/health/live`](https://queueproof.vercel.app/api/health/live). The only submission-safe
live and large-PDF values are results returned by
[`/api/lab`](https://queueproof.vercel.app/api/lab) for that same SHA.

If an artifact is older, missing, empty, incompatible, or says
`awaiting_current_release_measurement`, no number may be copied from it. The recorder reads the
values visibly shown in [Proof tests](https://queueproof.vercel.app/benchmarks).

## Differentiator

Search products return snippets. QueueProof turns fragmented work into an inspectable decision:

`connected evidence → supported claims → preserved conflict → next safe action → approval`

The receipt is the product contract: what supports the answer, what remains unknown, which mode
ran, what it cost in relative query work, and what permission is required before a write.

## Honest limits judges can verify

- A `REVIEW` row is a failed strict case, not a partial pass.
- Fast and Thinking are compared only on the same cases and same deployed release.
- Live samples are release diagnostics, not an SLA.
- Weighted units are not USD.
- Historical artifacts are provenance only and cannot populate current-release claims.
- A named MCP client is described as working only after an authenticated smoke test.
- Repository and video publication remain **PENDING**.
