# QueueProof baseline audit - historical before-state

> This document records the state found at the start of the 3 August 2026 hardening pass.
> It is intentionally not current release evidence. Use `README.md`,
> `BENCHMARK_REPORT.md`, and the other proof documents in `docs/` for current claims.

Audit date: 3 August 2026

Recorded baseline commit: `cafcd727acd18ce2828c49f0969d040ef6656395`

## What was already real

- A public Vercel product with durable Turso/libSQL storage.
- Four `data_verified` HydraDB connectors across GitHub, Gmail, Linear, and Slack.
- Claim-level synthesis, connector proof records, document ingestion, queue packets, MCP
  tokens, and action proposals.
- A functioning flagship query with GitHub, Linear, and Slack evidence.

## Baseline measurements (do not quote as current)

| Measure | Historical baseline |
| --- | ---: |
| Offline router agreement | 29/39 (74.4%) |
| Baseline full suite | 224 tests |
| Stored showcase run | 6 questions |

Later measurements use different code and, for the PDF suite, a stricter grading contract.
They must not be combined with these numbers.

## Defects found in the baseline

- The proof console was below the first viewport at important screen sizes.
- Sticky header and fixed toast positioning were accidentally overridden by later CSS.
- Approvals and Developer destinations disappeared from mobile navigation.
- Dialog focus, citation interaction, selected-state semantics, and URL/restoration
  behavior were incomplete.
- Partial or abstained answers could look fully grounded.
- Exact-ID planning described dual retrieval but did not execute both lanes.
- Same-product records could collapse into duplicate or incorrectly merged queue work.
- Connector attribution could fall back to provider name rather than strong lineage.
- Public demo users could reach sensitive control-plane mutations.
- Session payload parsing, MCP token audience validation, and action-execution uniqueness
  needed hardening.
- The PDF grader accepted token overlap without proving claim-to-citation support and used
  the wrong end-canary key.

## Current disposition

The current release candidate addresses those findings with:

- proof-first responsive layout and six-destination navigation;
- grounded/partial/abstained result states and accessible receipt dialogs;
- concurrent text + hybrid exact-ID retrieval;
- conflict-aware task clustering and fail-closed connector/resource lineage;
- a public sandbox control guard;
- versioned session claims, MCP audience enforcement, and an action integrity migration;
- a strict fact, citation, provider, and contradiction grader.

Current verified gates are 324 tests across 32 files, 13 security tests, 8 MCP tests,
39/39 router cases with 331 fixture assertions, plus passing typecheck, lint, build, E2E,
and deployment checks.
