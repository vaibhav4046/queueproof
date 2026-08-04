# QueueProof submission form answers

Retrieval, connector, and PDF measurements were taken on 4 August 2026 against release
`c7cf16b3c92f66d7b2f17a90e01372b77d62235b` on `main`. All nine product and owner routes
returned HTTP 200. The submitted runtime release is the current `main` SHA reported by
`/api/health/live`; the artifacts retain their own measured release identity. Do not submit
until the repository opens in a signed-out browser, final signed-out visual QA passes, and
every bracketed URL below is replaced.

## Product name

QueueProof

## One-line description

QueueProof turns HydraDB evidence from every work system into one cited answer and one
deterministic next-action packet, while keeping external writes behind human approval.

## Live URL

<https://queueproof.vercel.app>

## Measurement release

`c7cf16b3c92f66d7b2f17a90e01372b77d62235b` on `main`

## Repository URL

<https://github.com/vaibhav4046/queueproof>

**Publication gate:** open this URL in a signed-out browser and confirm the submitted release,
README, MIT license, and green CI workflow are visible. Do not describe it as public until that
check succeeds.

## Video URL

`[ADD FINAL VIDEO URL]`

Record from [docs/DEMO_SCRIPT_60S.md](../docs/DEMO_SCRIPT_60S.md).

## What problem does it solve?

Agents can execute tasks, but work evidence is split across tickets, code, messages, email,
and documents. Search returns fragments without proving which action deserves priority.
QueueProof creates an inspectable chain from connector proof, to cited claims, to a
deterministic priority receipt, to an approval-safe provider proposal.

## How does it use HydraDB?

HydraDB is QueueProof's evidence layer. QueueProof loads provider contracts, creates and
scopes connectors, starts sync, verifies them with a canary, retrieves in Fast or Deep
(`thinking`) mode, and ingests documents. A connector is not retrieval-eligible until
returned source IDs are
attributable to that connector or its selected resources.

Exact identifiers use lexical text and hybrid retrieval lanes, then merge and deduplicate the
evidence. Deep mode can perform one bounded follow-up using identifiers and named entities
discovered in the first hop. QueueProof stores the requested and actual mode, phase, lane,
request IDs, calls, latency, relative cost, providers, and citations in the receipt.

The final production release showed four verified sources: GitHub, Gmail, Linear, and Slack.
The measured mode comparison honored both forced modes on the same release.

## Fast versus Deep — same six strict questions

| Mode | Strict cases | Required facts | p50 | p95 | HydraDB calls | Mean calls | Weighted units | Cited providers |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Fast | 4/6 | 19/19 | 2,531 ms | 3,316 ms | 7 | 1.17 | 7 | GitHub, Linear, Slack |
| Deep (`thinking`) | 4/6 | 19/19 | 23,575 ms | 32,482 ms | 13 | 2.17 | 39 | GitHub, Gmail, Linear, Slack |

Both modes achieved 100% citation precision, 100% citation completeness, and 0% unsupported
claims. Fast preserved the same strict score and required-fact coverage while cutting median
latency by about 9.3×, using six fewer HydraDB calls and 32 fewer weighted units. The two
strict `REVIEW` rows remain visible even though all required answer facts were found.

## What is technically distinctive?

**Receipts are the product contract.** Every supported claim opens to source evidence. Every
queue item carries score math, constraints, permissions, missing information, and a receipt
hash.

**Routing is measured, not decorative.** Forced Fast and Deep runs use the same questions and
release, verify that the requested mode was honored, and expose accuracy, latency, calls, and
relative cost side by side.

**Lineage fails closed.** Provider equality is not enough to credit evidence to a connector.
Uploaded documents must match the requested HydraDB source ID.

**Priority is compiled, not improvised.** Conflict-aware clustering keeps unrelated exact IDs
separate and the ranking policy is versioned and deterministic.

**Writes have a database boundary.** Proposals are workspace-idempotent, approval is explicit,
and a unique execution row is claimed before provider I/O.

## What is verified?

- Measurement release: `c7cf16b3c92f66d7b2f17a90e01372b77d62235b` on `main`.
- Route acceptance: all nine product and owner routes returned HTTP 200.
- Four verified sources: GitHub, Gmail, Linear, and Slack.
- CI: 341/341 tests, 39/39 deterministic router cases, 331 assertions, production build,
  and deployment-binding check all passed.
- Forced Fast and Deep modes were honored on the same release; both matched 19/19 required
  facts with complete, supported citations and no unsupported claims.
- Final signed-out responsive and interaction QA remains a submission gate until its fresh
  receipt is recorded.

## How is the public product safe?

The public URL is a shared evidence workspace selected by
`QUEUEPROOF_PUBLIC_WORKSPACE_ID`. Public visitors can inspect evidence, ask bounded questions,
review queue packets, and create shared proposals. Server-side guards deny credential changes,
connector lifecycle changes, database creation, uploads, MCP token administration, and
external execution.

Owner sessions use signed, `httpOnly` cookies. HydraDB credentials are encrypted with AES-GCM.
MCP bearer values are hashed, scoped, expiring, revocable, and restricted to the
`queueproof-mcp` audience.

## Large-PDF evidence

QueueProof generated and indexed a deterministic 346-page, 958,096-byte PDF with 22 questions
and 56 required-fact groups spanning beginning, middle, and end canaries.

The fresh production artifact was generated at `2026-08-04T18:28:35.671Z` against release
`c7cf16b3`. It passed 20/22 cases and recovered 53/56 facts (94.6429%). Beginning, middle,
and end canaries all passed. All 84 claims were supported by 56 citations, with 100% citation
precision, 100% citation completeness, and 0% unsupported claims.

The run measured p50 2,592 ms and p95 17,061 ms, averaged 1.8182 HydraDB calls per question,
used Fast for 13 cases and Deep (`thinking`) for 9, and consumed 86 weighted units. The
cross-source case remains `REVIEW`: it found the document and GitHub, but needed one additional
non-document provider.

## Honest limitations

- The paired connector benchmark is six questions, not an SLA or a general accuracy claim.
- Both forced modes passed 4/6 strict cases; 19/19 fact coverage does not turn the two
  `REVIEW` rows into passes.
- Weighted units are relative retrieval units, not invented HydraDB dollar costs.
- The same-release PDF run passed 20/22, not 22/22; its cross-source provider miss remains
  `REVIEW`.
- A provider write is not described as executed without a stored provider response ID.
- Repository visibility, signed-out QA, video upload, and social-post URLs remain external
  submission gates.

## Hackathon form quick answers

**Did you try ingesting huge PDFs?** Yes. QueueProof indexed a deterministic 346-page,
958,096-byte PDF and evaluated 22 questions across 56 fact groups on the final release. The
fresh production run passed 20/22 cases and recovered 53/56 facts (94.6429%), with all three
canaries passing, 84/84 claims supported, 56 citations, complete citation precision and
completeness, and no unsupported claims. The document-plus-GitHub cross-source row remains
`REVIEW` because it needed one more non-document provider.

**Did you use at least three connectors?** Yes. Release `c7cf16b3` had four verified sources:
GitHub, Gmail, Linear, and Slack. The paired forced-mode benchmark retrieved cited evidence
from three providers in Fast and all four providers in Deep.

**Video demo:** `[ADD FINAL VIDEO URL]`

**GitHub submission:** <https://github.com/vaibhav4046/queueproof> — verify signed-out access
before submission.

**LinkedIn:** `[ADD FINAL LINKEDIN POST URL]`

**Twitter/X:** `[ADD FINAL X/TWITTER POST URL]`
