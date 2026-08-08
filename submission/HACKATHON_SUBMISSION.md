# QueueProof hackathon submission

> Release-relative draft. Before pasting, read the exact SHA and deployment receipt from
> [`/api/health/live`](https://queueproof.vercel.app/api/health/live), and read benchmark values
> only from matching measured rows in [`/api/lab`](https://queueproof.vercel.app/api/lab) or
> [Proof tests](https://queueproof.vercel.app/benchmarks). The repository is public; the video
> URL is pending until the owner uploads the committed final cut.

## Product name

QueueProof

## Hook

**Ask your work. Get the proof.**

## One-line description

QueueProof turns HydraDB evidence from work systems and documents into one cited answer and one
reviewable next-action brief, while keeping external changes behind human approval.

## Problem

Evidence about a release, incident, customer commitment, or deadline is split across code,
tickets, messages, email, and documents. Search returns fragments. A teammate or coding agent
still has to decide which records refer to the same thing, which source is newer, whether systems
disagree, and what is safe to do next.

## Solution

QueueProof retrieves through HydraDB, validates connector and document lineage, and returns
supported claims that open to retained receipts. Missing facets remain explicit. Contradictions
stay separate. The same evidence feeds a deterministic priority queue and an Execution Packet;
provider writes begin as evidence-linked proposals and require owner approval.

## Target users

- Engineering leads and on-call responders reconstructing incidents and release state
- Product/operations leads reconciling commitments, owners, and deadlines
- Individual contributors deciding what deserves attention today
- Coding and research agents that need verifiable work context without broad write authority

## Daily-driver workflow

1. Ask one question in **Ask**.
2. Read the concise answer and open a numbered claim receipt.
3. Inspect source health and document provenance under **Sources**.
4. Review the ranked next action and its score, constraints, missing proof, and permissions under
   **Today**.
5. Prepare a follow-up only when needed; an external change remains approval-gated.

## Incident workflow

Ask:

> Who escalated the AuthShield outage, what did engineering commit to, and is the fix already
> merged?

QueueProof must reconstruct actor, commitment, and code/tracked state from current evidence,
preserve any disagreement, cite every supported claim, and name a missing facet instead of filling
it with a guess.

## Coding-agent workflow

A Codex or Claude Code client can be configured for `https://queueproof.vercel.app/mcp` with OAuth
or a scoped, expiring bearer token. After a current authenticated receipt, it can discover
implemented tools, retrieve task evidence by verified connectorId or indexed sourceId, and read a
ranked action and Execution Packet. MCP can create a bounded Linear proposal only with explicit
scope and workspace-owned evidence; it cannot approve or execute the provider action.

Current MCP receipt (submitted deployment `24d942e`, 2026-08-08T03:18:28.661Z): on the public
no-auth reviewer endpoint `https://queueproof.vercel.app/mcp/demo`, `initialize` negotiated protocol
`2025-06-18` (server `queueproof 0.2.0`), `tools/list` returned `queueproof_search`, and a read-only
`tools/call` returned a grounded, citation-carrying answer — `validation.status "grounded"`,
providers linear/github/slack, 4 claims with 4 cited claims and 4 evidence items, one contradiction
preserved, `missingInformation []`, `partial false`, 4209 ms server-side, 1 retrieval call,
3 weighted units. The bearer-protected `/mcp`
endpoint returns `401` with RFC 9728 `WWW-Authenticate` resource metadata, and both
`/.well-known/oauth-protected-resource` and `/.well-known/oauth-authorization-server` publish the
live issuer, scopes, and registration endpoint. No signed-in client is named: an owner-token
authenticated call is deliberately left to the owner.

## Research workflow

QueueProof ingests a deterministic 346-page handbook with checksum, page count, QueueProof
document ID, and HydraDB source ID. Frozen questions cover beginning/middle/end canaries, exact IDs,
tables, superseded policy, multilingual context, close-name entities, distractors, and a separate
document-plus-connectors extension. Current pass/fact/citation/latency/call results are generated at
release and must remain separate from the live connector denominator.

## Architecture

| Layer | Role |
| --- | --- |
| Next.js/React | Public evidence workspace, owner controls, and JSON routes |
| HydraDB | Connector catalogue/lifecycle, cross-source retrieval, and document indexing |
| Turso/libSQL | Durable workspace, receipts, queue packets, approvals, executions, and audit state |
| Retrieval/ranking packages | Fast/Thinking plan, exact-ID lanes, evidence merge, clustering, and deterministic priority |
| MCP | Scoped agent access to the same workspace-bound records |

## HydraDB usage and connector proof

HydraDB is the evidence layer, not a logo integration. QueueProof discovers provider contracts,
selects resources, requests sync, and runs a canary. A connector becomes retrieval-eligible only
after returned records are attributable to its connector/resource lineage and a proof receipt is
stored. At submission, count only current **Sources** rows that are `data_verified`; a saved or
degraded connector does not count toward the required three.

Exact identifiers can use parallel text and hybrid lanes. Fast and Thinking calls retain mode,
request ID, latency, provider coverage, and relative query work in the receipt.

## Evidence validation

- Every supported claim must resolve to a retained excerpt and matching provider/source ID.
- Required providers count only when a supporting cited claim uses them.
- Multi-part questions declare missing actor, commitment, completion, date, project, or other
  facets.
- Contradictions require cited support from the disagreeing sources.
- Retrieved instructions are untrusted evidence and cannot grant authority.
- Strict `REVIEW` rows remain failures even when they recover some or all labelled facts.

## MCP integration

Canonical endpoint: `https://queueproof.vercel.app/mcp` over HTTP MCP with bearer authentication.
Tokens are hashed, workspace-bound, scoped, expiring, revocable, and audience-restricted. Read is
the default. The product registers implemented read, sync, result-recording, and proposal tools; the
live `resources/list` currently returns the `queueproof://demo/guide` resource, registers no fake
change-diff resource, and registers no MCP prompts. Supabase web
identity and the OAuth MCP resource-server path are implemented, including exact JWT
issuer/audience/scope validation and per-subject workspace binding. A named ChatGPT connection is
claimed only after current-release consent, discovery, and one harmless read-only tool receipt.

Setup: [Remote MCP](../docs/REMOTE_MCP_SETUP.md) ·
[ChatGPT workflow](../docs/CHATGPT_MCP_SETUP.md) ·
[Claude workflow](../docs/CLAUDE_QUEUEPROOF_WORKFLOW.md) ·
[Codex workflow](../docs/CODEX_QUEUEPROOF_WORKFLOW.md)

## Security model

Public visitors can inspect shared evidence, ask bounded questions, and review queue packets.
Credentials, connector mutation, document upload, token administration, approval, and execution
are owner-only and enforced server-side. Owner sessions use signed `httpOnly` cookies. Provider
credentials are encrypted. Proposals are workspace-scoped and idempotent; concurrent approvals
cannot create two provider calls, and success requires a stored provider response ID.

## Production benchmark — generated at release

Measured against production `24d942e4d5281db58e352c9fed14ac8fcb2aba8d` on 2026-08-08; every
artifact carries `releaseVerified: true` and grader `grounded-grader-v3`.

| Run | Strict pass/cases | Facts | Claim support | Citation resolution | p50/p95 | HydraDB calls | Weighted units |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Auto | 7/8 | 25/25 | 1.0 | 1.0 | 2084 / 4451 ms | 10 | 10 |
| Fast | 7/8 | 25/25 | 1.0 | 1.0 | 1907 / 3315 ms | 10 | 10 |
| Thinking | 7/8 | 25/25 | 1.0 | 1.0 | 8766 / 16886 ms | 18 | 34 |
| 346-page PDF core | 5/22 | 56/56 | 1.0 | 1.0 | 1570 / 2096 ms | 29 | 29 |

Fast/Thinking delta: **comparable, and Thinking lost.** Identical strict passes (7/8) and identical
fact recall (25/25) for 4.6x the p50 latency and 3.4x the weighted units. Auto routed all eight rows
to the fast lane. Reported as measured rather than framed as a win for the expensive mode.

Failed cases, in full, with no timeouts in any run:

- Connector fixture, one non-pass row in all three modes: `post-mortem attribution cross-check`
  returns `REVIEW`. It recovers 3/3 required facts with citation precision and completeness both
  1.0 and zero unsupported claims; it fails strict relevance alone (0.667) because one of three
  grounded, correctly cited claims does not answer the question asked.
- PDF fixture, 17 non-pass rows of 22, all `REVIEW` and all HTTP 200 with `exactIdPass` and
  `documentReceipt` true. Overall recall is 56/56 required facts at citation precision 1.0; the
  rows fail strict relevance (mean 0.534 across the non-pass subset) because synthesis deliberately splits handbook table rows into
  independent claim units, and the resulting ASCII-table fragments carry no expected-fact signal.
  Retuning that splitter was declined at release time: it would risk a green production release to
  improve a grading artifact, not correctness.

These are release diagnostics, not an SLA. Weighted units are relative query work, not USD.

## Reproducibility

```bash
corepack enable
corepack prepare pnpm@10.33.0 --activate
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm benchmark:router
pnpm build
pnpm deploy:check
pnpm release:verify -- --url https://queueproof.vercel.app --sha 24d942e4d5281db58e352c9fed14ac8fcb2aba8d
pnpm benchmark:live -- --url https://queueproof.vercel.app --mode auto
pnpm benchmark:live -- --url https://queueproof.vercel.app --mode fast
pnpm benchmark:live -- --url https://queueproof.vercel.app --mode thinking
pnpm benchmark:pdf -- --url https://queueproof.vercel.app
```

The live and PDF runs query connected data and are separate from deterministic CI. Publishing uses
a dedicated secret and is not shown in public copy.

## Links

- Live product: <https://queueproof.vercel.app>
- Proof tests: <https://queueproof.vercel.app/benchmarks>
- Method: <https://queueproof.vercel.app/method>
- Repository: <https://github.com/vaibhav4046/queueproof> — public
- Video: final 59.5 s cut committed at `video/queueproof-demo-v2.mp4` (−15.0 LUFS / −1.3 dBTP,
  transcript verified against the locked script) — **PENDING PUBLIC URL** (owner uploads to
  YouTube/Drive and pastes the link into the form)

## Setup for judges

1. Open the live product; no account is required for the public read workspace.
2. Run the AuthShield question and open a numbered claim receipt.
3. Open **Sources** and count only current ready connectors with attributable records.
4. Open **Proof tests**, compare its SHA with `/api/health/live`, and inspect failures.
5. Open **Connect AI** to inspect the endpoint, scopes, and approval boundary.

## Measured limitations

- Strict grading is unforgiving on purpose. A `REVIEW` row is a failure even when it recovers every
  labelled fact with perfect citations, which is why the PDF core column reads 5/22 next to 56/56
  facts. The two numbers are both true and are shown together rather than one without the other.
- Third-party connector availability can change; the current Sources receipt is authoritative. Four
  connectors currently carry attribution proof; a fifth Linear connector is `degraded` with zero
  canary results and is excluded from the denominator rather than hidden.
- The live corpus is deliberately small and cannot establish a general SLA.
- Thinking may be slower or less accurate on a given frozen sample; the result will be shown as
  measured rather than hidden.
- The document-plus-connectors extension is reported separately from PDF core cases.
- A named MCP client is unverified until an authenticated production tool call exists.
- Repository publication and video recording/upload are manual owner actions.
