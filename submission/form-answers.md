# QueueProof submission form answers

Prepared from measurements taken on 4 August 2026. The exact final application commit is
published and the strict live run is complete. Do not submit until the repository is made
judge-accessible and the bracketed video field is replaced.

## Product name

QueueProof

## One-line description

QueueProof turns HydraDB evidence from every work system into one cited answer and one
deterministic next-action packet, while keeping external writes behind human approval.

## Live URL

<https://queueproof.vercel.app>

## Repository URL

<https://github.com/vaibhav4046/queueproof>

The repository was verified as **private** on 4 August 2026. Make it public or invite the
judges before submitting.

## Video URL

`[ADD FINAL VIDEO URL]`

Record from [docs/DEMO_SCRIPT_60S.md](../docs/DEMO_SCRIPT_60S.md).

## What problem does it solve?

Agents can execute tasks, but work evidence is split across tickets, code, messages,
email, and documents. Search returns fragments without proving which action deserves
priority. QueueProof creates an inspectable chain from connector proof, to cited claims,
to a deterministic priority receipt, to an approval-safe provider proposal.

## How does it use HydraDB?

HydraDB is QueueProof's evidence layer. QueueProof loads provider contracts, creates and
scopes connectors, starts sync, verifies them with a canary, retrieves in fast or thinking
mode, and ingests documents. A connector is not eligible until returned source IDs are
attributable to its connector or selected resources.

Exact identifiers use HydraDB twice in parallel: a lexical text lane for precision and a
hybrid lane for aliases and surrounding semantic context. Thinking mode can then perform
one bounded hybrid follow-up using only identifiers and named entities discovered in the
first-hop evidence. QueueProof merges and deduplicates every result and records the phase,
lane, request ID, call count, latency, and relative cost in the receipt. Fast mode remains
a single hybrid call for ordinary questions.

The last observed production workspace had four `data_verified` connectors: GitHub,
Gmail, Linear, and Slack. The flagship question returned cited GitHub, Linear, and Slack
evidence in one thinking query.

## What is technically distinctive?

**Receipts are the product contract.** Every answer claim opens to source evidence. Every
queue item carries the score math, constraints, permissions, missing information, and a
receipt hash.

**Routing is deterministic but evidence-aware.** Multi-step reasoning is detected before
the exact-ID lane is chosen. Exact IDs use both text and hybrid retrieval rather than
trading lexical recall for semantic context.

**Lineage fails closed.** Provider equality is never enough to credit evidence to a
connector. Uploaded documents must match the requested HydraDB source ID.

**Priority is compiled, not improvised.** Conflict-aware clustering keeps unrelated exact
IDs separate and the ranking policy is versioned and deterministic.

**Writes have a database boundary.** Proposals are workspace-idempotent, approval is
explicit, and a unique execution row is claimed before provider I/O.

## What is verified?

- Typecheck, lint, production build, E2E, and deployment check pass.
- 330 tests across 35 files pass.
- Security suite: 13 tests. MCP suite: 8 tests.
- Offline router benchmark: 39/39 labelled cases and 331 assertions.
- Responsive QA: 360x800, 390x844, 768x1024, 1440x900, 1920x1080,
  2560x1440, and 3840x2160.
- Tracked-release secret scan: zero literal credential matches for the final candidate.
- Four last-observed production connectors at `data_verified`; flagship cited evidence
  from GitHub, Linear, and Slack.

## How is the public demo safe?

The public URL is a shared evidence sandbox. `QUEUEPROOF_PUBLIC_WORKSPACE_ID` selects the
exact workspace; an unconfigured singleton fallback works only when the database contains
one workspace and fails closed when multiple exist.

Public visitors can inspect evidence, ask questions, review queue packets, and create
shared proposals. Server-side guards deny credentials, connector lifecycle changes,
database creation, uploads, MCP token administration, and external execution.

Sessions use versioned HMAC-signed JSON claims. HydraDB credentials are AES-GCM encrypted.
MCP bearer values are hashed, scoped, expiring, revocable, and restricted to the
`queueproof-mcp` audience.

## How is it evaluated?

Fixture, live, and PDF evaluation remain separate. The deterministic router suite is
39/39. The strict grounded grader requires every expected fact, resolves every citation,
checks claim text/provider against the excerpt, and requires two cited providers for a
labelled contradiction.

The deterministic 346-page PDF contains 22 questions and 56 required-fact groups. A fresh
`grounded-grader-v2` run against the public deployment on 4 August recovered 53/56 facts
and passed 20/22 cases, with 100% citation precision/completeness and zero unsupported
claims. Beginning, middle, and end canaries all passed. The document-plus-connectors case
found document and GitHub evidence but missed the required second connector, so it remains
REVIEW. This remains a separately scoped strict production benchmark.

## Honest limitations

- The final six-query production sample passed 4/6 complete cases and matched 19/19
  required facts. Citation precision/completeness were 100% with zero unsupported claims;
  the two REVIEW cases missed frozen multi-provider requirements, so this small sample is
  a diagnostic, not an SLA or a general accuracy claim.
- The fresh strict PDF baseline is 20/22, not 22/22.
- Relative query units are shown; no HydraDB dollar cost is invented.
- A provider write is not described as executed without a stored provider response ID.
- Repository access and the final video URL remain gates.

## Hackathon form quick answers

**Did you try ingesting huge PDFs?** Yes. QueueProof indexed a deterministic 346-page,
958,096-byte PDF and ran 22 strict questions spanning beginning, middle, and end facts.
Fresh public-production baseline: 20/22 cases and 53/56 required facts; 100% citation
precision/completeness; zero unsupported claims. Two cases and the connector join remain
REVIEW pending post-release rerun.

**Did you use at least three connectors?** Yes. The last observed production workspace had
four `data_verified` connectors: GitHub, Gmail, Linear, and Slack. The flagship live answer
contained supporting citations from GitHub, Linear, and Slack.

**Video demo:** `[ADD FINAL VIDEO URL]`

**GitHub submission:** <https://github.com/vaibhav4046/queueproof> — currently private;
make judge-accessible before submission.

**LinkedIn:** use [docs/SOCIAL_POSTS.md](../docs/SOCIAL_POSTS.md), then add the post URL.

**Twitter/X:** use [docs/SOCIAL_POSTS.md](../docs/SOCIAL_POSTS.md), then add the post URL.
