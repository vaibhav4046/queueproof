# QueueProof submission form answers

Paste-ready as of 3 August 2026. Replace the bracketed video field before submission.

## Product name

QueueProof

## One-line description

QueueProof turns HydraDB evidence from every work system into one cited answer and one
deterministic next-action packet, while keeping external writes behind human approval.

## Live URL

<https://queueproof.vercel.app>

## Repository URL

<https://github.com/vaibhav4046/queueproof>

Confirm that judges have repository access before submitting.

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
hybrid lane for aliases and surrounding semantic context. QueueProof merges and
deduplicates the results and records both calls in the receipt.

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
- 274 tests across 29 files pass.
- Security suite: 13 tests. MCP suite: 8 tests.
- Offline router benchmark: 39/39 labelled cases and 331 assertions.
- Responsive QA: 360x800, 390x844, 768x1024, 1440x900, 1920x1080,
  2560x1440, and 3840x2160.
- Secret scan: zero matching files across the final worktree and complete pre-release history for AWS,
  GitHub, OpenAI, Slack, Linear, and private-key patterns.
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

The deterministic 346-page PDF contains 22 questions and 56 required-fact groups. Its
stored production artifact is 21/22 under the old grader and is not comparable with the
current strict grader. QueueProof does not claim a fresh strict production PDF result.

## Honest limitations

- The six-query stored live sample is small and not an SLA.
- No fresh production PDF score is claimed after grader hardening.
- Relative query units are shown; no HydraDB dollar cost is invented.
- A provider write is not described as executed without a stored provider response ID.
- Repository access and the final video URL must be confirmed before submission.
