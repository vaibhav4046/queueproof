# WINNER_STATUS

CURRENT GATE: Gates 1, 3 (document artefact), 5, 6, 7 and 9 have landed as far as they can
without credentials. Gates 2, 4, 8 and 10 are blocked on external authorisation and cannot
be reached by writing code.

IMPLEMENTED:
- **Gate 1 — public application.** `app/page.tsx` is a server component that resolves the
  screen before any HTML is sent, via `lib/server/workspace-state.ts` (discriminated union:
  `storage_unconfigured` / `sign_in_required` / `no_workspace` / `ready`). Boot screen
  deleted. Sign-in screen added — it did not exist. `BootError` gives a cause and a retry.
- **Gate 3 — document artefact.** `scripts/generate-large-pdf.mjs` writes a real 346-page
  PDF with no external dependencies, plus 22 planted ground-truth facts.
  HydraDB ingestion is NOT implemented and is not claimed.
- **Gate 5 — priority integrity.** `ranking_items.sensitivity_json` now stores the real
  `RankingInput` (was `{}`), making scores replayable. `whyAboveNext` explains a ranking gap
  from score components only. `applyAssumption` re-scores a single named assumption without
  mutating stored input.
- **Gate 6 — evaluation.** `scripts/run-evals.mjs` runs 39 cases across all 15 categories
  against the real `planRetrieval` and real `rank()`. Fixture and live metrics are labelled
  separately; `--live` without credentials exits 2 rather than fabricating.
- **Gate 7 — parity.** Canonical hash and `why_above_next` are computed once during queue
  generation and persisted inside `packet_json`, so every surface reads the same bytes.
- **Gate 9 — quality.** No dead controls, no fabricated metrics, no external dead links.

PROVEN BY:
- Server-rendered shell, production build, JavaScript disabled, reading raw HTML:
  `Establishing workspace trust boundary` count **0** in every state; sign-in **1**;
  create-workspace **1**; primary navigation **1**.
- Production: `GET /` 200, `/api/health/live` 200, `/api/session` 200,
  `/api/health/ready` 503 naming `databaseBinding`, `encryptionKey`.
- Large PDF, clean run, exit 0: **346 pages, 958,096 bytes**, SHA-256
  `c047a3d09c45ecf97e3ed8e2115eda08ea0f6152206237955030f4304fa2ed93`, 699 xref offsets
  verified, 78 internal checks passed. Identical hash across runs. Verified with an
  independent PDF parser, not only its own inspector.
- Evaluation, measured not claimed: **router mode accuracy 29/39 = 74.4%**, per-category
  breakdown exported to `BENCHMARK_REPORT.md`. Unmeasurable metrics written as
  "not measured".
- Nine authentication attack variants return 401; a valid session returns 200.
- **162 tests**, typecheck 0, lint 0, production build 0.

FAILED:
- Router aggregate accuracy did not improve after fixing the exact-ID short-circuit:
  under-escalations fell 8 → 7, over-escalations rose 2 → 3, net 74.4% unchanged. Recorded
  as measured rather than presented as a win. Known cause: 7 of 13 declared
  `QueryCategory` values are never returned by the router, so entity-dedup and priority
  cases cannot classify correctly.
- Document upload route and the Linear action path were started and not delivered: both
  subagents terminated immediately on an account session limit. No partial code was
  written; the working tree stayed clean.

EXTERNAL AUTHORISATION REQUIRED (see `AUTH_REQUIRED.md`):
1. `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `QUEUEPROOF_ENCRYPTION_KEY`,
   `QUEUEPROOF_ACCESS_TOKEN` on the deployment — until then production renders the
   storage-unconfigured screen.
2. HydraDB API key — gates 2, 3 (ingestion), 4, 6 (live half).
3. Slack, Gmail, Linear OAuth — gates 2, 4, 8.

Check current state at any time:
`QUEUEPROOF_URL=https://queueproof.vercel.app node scripts/doctor.mjs`

NEXT CODE ACTION: document upload route (`app/api/documents`) with magic-byte validation,
SHA-256 duplicate detection and real stage tracking up to the HydraDB boundary; then the
Linear proposal/approval path with deterministic idempotency keys. Both are fully specified
and unblocked apart from execution against the live providers.

---

## Live verification, 2026-08-02

Two connectors verified end to end, both driven entirely through the product.

| Connector | Stage | Real objects | Evidence |
| --- | --- | --- | --- |
| Linear | `data_verified` | 5 | `verify_fafc753e`, providerCoverage `["linear"]` |
| Slack | `data_verified` | 3 | `verify_87da58b8`, resource `C0B462AK7U3` |

Cross-source retrieval, one question, 11 sources spanning both providers, `thinking`
mode, 4220 ms end to end:

  "Who escalated the AuthShield outage, what deadline did engineering commit to,
   and does Linear agree?"

It returned the contradiction rather than averaging over it:

  linear -> "Billing migration deadline moved to 14 August"
  slack  -> "the Linear ticket still says 14 August, but finance confirmed today
             it is staying at 7 August. Linear is out of date."

Queue regenerated with both providers present:

  #1  77  linear  AuthShield authentication outage for Northwind
  #2  67  slack   commitment to ship the AuthShield fix before 7 August
  #3  58  slack   promised post-mortem with no Linear issue tracking it

Item 3 is an untracked commitment surfaced from real evidence, which is the case the
product exists to catch.

**Update, 2026-08-04**: Gmail has since reached `data_verified` in production, with 4 proven
records, confirmed by direct inspection of https://queueproof.vercel.app. All four connectors
(GitHub, Linear, Slack, Gmail) are now verified. The section below is left as written on
2026-08-02 for the record of how that state was reached — it was correct when written.

## Gmail: configured, authenticated, not verified (as of 2026-08-02 — see update above)

Status as of 2026-08-02. Recorded because the distinction matters.

What works: the Google App Password authenticates. HydraDB connector
`3c628abf-b14d-4cfa-bbc7-27a03fa6b2ac` was created through the product, discovery
returned eight real labels (INBOX, All Mail, Drafts, Important and others), and configure
succeeded with `configured: 1`.

What has not happened: `provider_cursor` is still empty after roughly 50 minutes across
two lookback settings, so verification correctly reports `sync_evidence_missing` and
refuses to mark the connector `data_verified`.

Cause, read from the resource record rather than guessed:

    backfill_chunk_interval_seconds : 1800
    backfill_status                 : active
    plan                            : free

HydraDB's free plan advances the backfill one chunk per 30 minutes. Triggering a manual
sync does not bypass that scheduler, which was confirmed by reducing the lookback from 90
days to 1 and observing no change in cadence. This is a throughput limit of the plan, not
a credential fault and not a defect in the connector lifecycle.

The expected outcome is that Gmail reaches `data_verified` unattended once enough chunks
have run. It is NOT claimed as verified here, and the submission materials list it as
unverified. Three connectors, Linear, Slack and GitHub, are verified with evidence.

The product behaved correctly throughout: it never reported a connector as connected on
the strength of a stored credential.
