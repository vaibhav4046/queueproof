# QueueProof submission form answers

> [!IMPORTANT]
> Submission draft for the current main evidence build. Verify its exact deployed identity via
> `/api/health/live` and `RELEASE_EVIDENCE.md`. Production measurements were generated against
> runtime `aed027879150e3e324b54c5ec2194d4d715c501e` on `main`; they do not become
> evidence-build measurements unless that build is deployed and the runs are repeated. The
> repository remains private and the video is pending.

## Product name

QueueProof

## One-line description

QueueProof turns HydraDB evidence from work systems into one cited answer and one
evidence-backed Task brief, while keeping external changes behind human approval.

## Product thesis

Ask your work. Get the proof.

## Live URL

<https://queueproof.vercel.app>

## Measured runtime

`aed027879150e3e324b54c5ec2194d4d715c501e` on `main`

## Evidence-build identity

Current main evidence build — record the exact SHA after commit and verify it through
`/api/health/live` after deployment.

## Repository URL

<https://github.com/vaibhav4046/queueproof>

**Pending gate:** the repository is private. Make it public, then verify the submitted commit,
README, license, and CI receipt from a signed-out browser before submitting this link.

## Video URL

`[PENDING — ADD PUBLIC VIDEO URL]`

## What problem does it solve?

Work evidence is split across tickets, code, messages, email, and documents. Search returns
fragments, but an agent still needs to know what happened, which sources disagree, and what
deserves attention next. QueueProof produces an inspectable chain from verified source, to
cited claim, to Task brief, to an approval-safe proposal.

## How does it use HydraDB?

HydraDB is QueueProof's evidence layer. QueueProof scopes connectors, waits for sync, verifies
them with attributable canary records, retrieves in Fast or Thinking mode, and ingests
documents. Exact identifiers use text and hybrid lanes; the evidence is merged without
collapsing unrelated IDs.

Each receipt stores requested and actual mode, retrieval lanes, request IDs, providers, calls,
latency, relative cost, and citations. In the product UI, forced Fast is **Quick**, Auto is
**Best**, and Thinking is **Investigate / Deep check**.

The public workspace last showed four verified sources: GitHub, Gmail, Linear, and Slack.

## Production mode comparison

All rows below were measured against runtime `aed027879150e3e324b54c5ec2194d4d715c501e`.

| Product / measured mode | Strict cases | Required facts | p50 | p95 | Calls | Relative units | Boundary |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Best / Auto | 4/6 | 19/19 | 2,155 ms | 2,392 ms | 7 | 7 | All six resolved as Fast |
| Quick / forced Fast | 4/6 | 19/19 | 1,833 ms | 2,446 ms | 7 | 7 | Two provider-requirement rows remain REVIEW |
| Investigate / forced Thinking | 2/6 | 13/19 | 26,329 ms | 40,003 ms | 10 | 30 | One timeout; lower fact and strict-case coverage |

The paired benchmark uses six frozen questions. It is a diagnostic, not an SLA. The forced
Thinking result is intentionally reported even though it underperformed Fast.

## What is technically distinctive?

**Receipts are the contract.** Each supported claim resolves to source evidence, and each
Task brief exposes score math, constraints, permissions, missing information, and a receipt
hash.

**Routing is measurable.** Quick/Fast, Best/Auto, and Investigate/Thinking expose accuracy,
latency, calls, relative units, and actual routing behavior rather than hiding them behind one
quality label.

**Lineage fails closed.** Provider labels alone do not prove connector origin. Connector and
document evidence must carry attributable lineage.

**Priority is compiled.** Conflict-aware clustering keeps unrelated identifiers separate,
then a versioned ranking policy produces the Task brief.

**Writes have a database boundary.** An external action requires an exact proposal, explicit
approval, and a unique execution claim before provider I/O.

## Large-PDF evidence

QueueProof generated and indexed a deterministic 346-page PDF with 22 core questions and 56
fact groups spanning the beginning, middle, and end of the document.

The runtime-A core run passed **21/22 cases** and recovered **55/56 facts**. It measured p50
**1,823 ms** and p95 **2,382 ms**, used **31 calls / 31 relative units**, and routed all 22
core questions through Fast. All three position canaries passed. The grader resolved **69
citations** and found **84/84 claims supported**.

The separate cross-source extension remains **REVIEW**. It found both required facts and
retrieved the document plus GitHub, but missed one additional non-document provider required
by the rubric. It measured **29,676 ms** and used **6 calls / 18 relative units**. It is not
included in the 21/22 core denominator.

## Reproducibility

- Measured runtime: `aed027879150e3e324b54c5ec2194d4d715c501e`.
- Evidence build: current main; exact SHA pending commit and `/api/health/live` verification.
- Deterministic router fixture: 39/39 labelled cases and 331 fixture-computable assertions;
  not a live accuracy claim.
- Current CI, security, MCP, build, E2E, deployment, responsive, and secret-scan results must
  be copied only from the completed evidence-build receipt in `RELEASE_EVIDENCE.md`.

## How is the public product safe?

The public URL is a shared evidence workspace. Visitors can inspect receipts, ask bounded
questions, review Task briefs, and prepare proposals. Server-side guards deny credential
changes, connector lifecycle changes, uploads, MCP token administration, approval, and
external execution.

Owner sessions use signed `httpOnly` cookies. Provider credentials are encrypted. MCP bearer
values are hashed, scoped, expiring, revocable, and audience restricted.

## Honest limitations

- The six-query benchmark is not an SLA or a general accuracy estimate.
- Thinking passed 2/6 and matched 13/19 facts in this run; one request timed out.
- The PDF core is 21/22 and 55/56, not perfect.
- The PDF cross-source extension remains REVIEW despite finding both required facts.
- Relative units are not HydraDB dollars.
- A provider write is not called executed without a stored provider response ID.
- Repository publication, signed-out verification, evidence-build gates, video, and social
  URLs are still pending.

## Hackathon form quick answers

**Did you try ingesting huge PDFs?** Yes. QueueProof indexed a deterministic 346-page PDF and
evaluated 22 core questions across 56 fact groups. The measured core run passed 21/22 cases,
recovered 55/56 facts, supported 84/84 claims with 69 citations, and passed beginning, middle,
and end canaries. The separate document-plus-GitHub cross-source extension remains REVIEW
because it needed one additional non-document provider.

**Did you use at least three connectors?** Yes. The public workspace last showed four verified
sources: GitHub, Gmail, Linear, and Slack. The measured Auto and Fast runs retrieved cited
cross-source evidence; connector verification and retrieval coverage are reported separately.

**Video demo:** `[PENDING — ADD PUBLIC VIDEO URL]`

**GitHub submission:** <https://github.com/vaibhav4046/queueproof> — currently private; publish
and verify signed-out access before submission.

**LinkedIn:** `[PENDING — ADD FINAL LINKEDIN POST URL]`

**Twitter/X:** `[PENDING — ADD FINAL X/TWITTER POST URL]`
