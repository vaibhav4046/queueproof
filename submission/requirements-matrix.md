# QueueProof acceptance matrix

Status labels are deliberately narrow. Nothing is marked exercised unless it was actually
run and observed.

- **exercised**: the behaviour was run and the result observed, locally or on the live
  deployment.
- **built-unproven**: the code exists and passes typecheck, lint, and the test suite, but
  the path has never been run against a live account. Not a working feature.
- **blocked-credentials**: cannot be proven without a HydraDB API key or provider
  authorisation. Neither is present, and no fixture is substituted.
- **not-built**: does not exist in this repository.

## Platform and security

| Capability | Status | Evidence or gate |
|---|---|---|
| Durable storage adapter | exercised | `lib/server/d1-compat.ts` implements the D1 statement surface over hosted libSQL/Turso and `node:sqlite`. Workspace created, persisted across requests, duplicate rejected. |
| Session authentication | exercised (manually) | HMAC-signed httpOnly cookie via `/api/session`. Nine attack variants all returned 401: spoofed `oai-authenticated-user-email`; `Host: localhost.attacker.example`; `Host: localhost` reading `/api/mcp-tokens`; no credentials; wrong access token; garbage signature; payload swapped with signature kept; unsigned payload; correctly signed but expired. Valid session returned 200. Run by hand and recorded in `BUILD_STATUS.md`; no automated test covers it. |
| Local run without accounts | exercised | `npm run dev` with `QUEUEPROOF_ENCRYPTION_KEY` and `QUEUEPROOF_ALLOW_LOCAL_IDENTITY=true`. `/api/health/ready` returned 200 with all three checks true; `/api/session` issued a local actor. |
| Live deployment | exercised | <https://queueproof.vercel.app> is up. No database is bound and no environment variables are set, so it renders a setup screen naming what it needs. `/api/health/ready` returns 503 with `databaseBinding`, `uploadBinding`, and `encryptionKey` all false. |
| Readiness endpoint on Vercel | known defect | `/api/health/ready` requires `uploadBinding`, which resolves from the Cloudflare R2 `FILES` binding. The Vercel runtime has no Cloudflare bindings, so readiness returns 503 there even when storage and the encryption key are set correctly. The user-facing screen is gated on storage availability instead, so a configured deployment would still work while readiness misreports it. It is weak in the other direction too: the Vercel runtime falls through to `process.env`, so a stray `FILES` variable of any value flips it to 200 for a bucket that does not exist. Do not present the 503 as purely "no database bound". |
| `/api/health/dependencies` HydraDB field | known defect | `hydradb.configuredPerWorkspace` is a hardcoded `true` literal, not a live check. Only the `storage.*` fields in that response are meaningful. |
| Honest empty state | exercised | With no storage the app reports `not_ready` and names the missing variables. It does not fall back to fixtures or browser storage. |
| Secret hygiene | exercised | Secret scan over the working tree, the full git history, and the build output found zero secrets. |
| Quality gates | exercised | 90 tests pass across 9 files. Typecheck, lint, and the production build are clean. |
| Prompt-injection screening | exercised (unit) | 13 security tests pass. Gate: live adversarial evaluation against real retrieved content. |
| SSRF URL policy | exercised (unit) | 17 SSRF tests pass. |
| Credential encryption | built-unproven | AES-GCM with a random IV per secret, keyed by a SHA-256 digest of `QUEUEPROOF_ENCRYPTION_KEY`; the browser receives only a 16 character fingerprint. No live provider credential has been stored. |

## Ranking and packets

| Capability | Status | Evidence or gate |
|---|---|---|
| Deterministic ranking policy | exercised | `packages/ranking` is a pure function. Nine components plus a penalty map, clamped 0 to 100, banded, carrying `policyVersion` and an explanation array. 4 ranking tests pass. Gate: calibration against a live corpus. |
| Ranking comparison | exercised (unit) | Covered by the ranking tests. |
| Counterfactual analysis | not-built (as a feature) | The arithmetic exists in `packages/ranking` and is unit tested, but no production code path calls it. Must not be presented as a product capability. |
| Execution Packet schema | built-unproven | Contract tests pass over the required evidence shape (source, title, excerpt, timestamp, link, authority). No packet has been built from real provider evidence. |
| Command Queue | blocked-credentials | Live-only retrieval feeding the shared ranker. Requires actionable records from a live source. |
| Web, API, and MCP read the same packet | built-unproven | The shared storage path exists in code. Not exercised with a live packet ID. |

## MCP

| Capability | Status | Evidence or gate |
|---|---|---|
| Authenticated MCP endpoint | exercised | Handshake completes and negotiates protocol version `2025-11-25`. |
| Tool surface and scope gating | exercised, with a gap | Fourteen tools are registered. A read plus propose token is offered 13; `queueproof_sync_connector` requires `queueproof:sync`. Gating happens at registration, so an out-of-scope tool is never listed. Gap: the static fallback credential (`QUEUEPROOF_MCP_TOKEN` plus `QUEUEPROOF_MCP_WORKSPACE_ID`) authenticates without a stored token row and keeps the default full scope set, so scope narrowing applies to app-issued tokens only. |
| MCP resources for absent tables | known defect | The server registers `queueproof-skills` and `queueproof-policies` resources whose tables are neither in the read allowlist nor created by the schema, so reading either throws. An agent listing resources sees two capabilities this matrix lists as not-built. A third, `queueproof-changes`, does resolve, but only as an alias for `queue_snapshots`; it is not a change ledger. |
| Idempotent action proposal | exercised | `queueproof_propose_action` called twice with the same `idempotencyKey` returned the same `proposalId` rather than creating a second proposal. |
| MCP token lifecycle | built-unproven | Tokens are shown once, stored only as a hash, and carry an audience, expiry, and scopes. Token authentication was exercised; the browser create and revoke flow was not separately exercised. |
| Agent completion report | built-unproven | `queueproof_report_execution_result` records an event and never performs a provider write. Gate: a live agent call. |
| OAuth 2.1 authorisation server | not-built | Not claimed. MCP uses bearer tokens. |

## Connectors and evidence

There is no Linear, Slack, or Gmail *integration* in this repository: no provider client,
no auth flow, no API call. The connector layer is provider-agnostic and expects providers
to arrive from the HydraDB runtime catalogue. Grepping the tree for those names returns
exactly four kinds of hit, none of which contacts a provider: a query-mode keyword regex
in `packages/retrieval`, a generic-title stop-word regex in `lib/server/queue.ts`, UI
empty-state copy offering them as catalogue examples, and query strings in the routing
fixtures under `evals/fixtures/cases.json` and `tests/retrieval.test.ts`.

**No connector has ever been run live, and no provider write has ever been executed.**

| Capability | Status | Gate |
|---|---|---|
| HydraDB catalogue and contract hydration | blocked-credentials | HydraDB API key |
| Database list and create | blocked-credentials | HydraDB account |
| Dynamic credential fields and account scope | blocked-credentials | Provider contract |
| Resource discovery | blocked-credentials | Provider authorisation |
| Scoped configure and initial backfill | blocked-credentials | Live resources |
| Connector proof reaching `data_verified` | blocked-credentials | A completed live sync plus a canary retrieval |
| Slack | blocked-credentials | Slack authorisation. No Slack integration exists. |
| Gmail | blocked-credentials | Gmail authorisation. No Gmail integration exists. |
| Linear | blocked-credentials | Linear authorisation. No Linear integration exists. |
| Cross-source Ask with citations | blocked-credentials | Two or more live sources |

## Not built

| Capability | Status | Note |
|---|---|---|
| Document and PDF upload, HydraDB ingestion | not-built | No upload code. `scripts/generate-large-pdf.mjs` is a two line stub that generates nothing. |
| Evaluation lab, accuracy, latency, cost | not-built | `scripts/run-evals.mjs` is seven lines and reports the length of a fixture array. No quality figure is produced anywhere in this repository. |
| Memory and learning | not-built | |
| Skills runtime | not-built | |
| Decision replay | not-built | |
| Execution leases | not-built | |
| Change-ledger diffing | not-built | |
| Provider write executor | not-built | By design: the system proposes and records, and stops at the approval gate. |
| R2 upload staging | not-built | The `FILES` binding is declared and readiness checks it, but nothing writes to it. |

## Not assessed

| Item | Note |
|---|---|
| Responsive and accessibility sweep | Not exercised in this pass. Do not claim device or accessibility coverage. |
| Second hosted deployment | The previously advertised `queueproof-control-plane.vaibhav09908.chatgpt.site` returns 401 and is not usable by a judge. It is no longer referenced. <https://queueproof.vercel.app> is the only deployment claimed. |

## Definition-of-done blocker

The single blocker is unchanged: without a HydraDB API key and provider authorisation,
this repository cannot honestly claim a working connector, a live cross-source answer, or
any measured quality figure. That gate is stated plainly rather than papered over with
fixtures. Everything outside that gate, storage, authentication, the MCP surface, the
ranking policy, and the honest empty state, is exercised and checkable on a laptop.
