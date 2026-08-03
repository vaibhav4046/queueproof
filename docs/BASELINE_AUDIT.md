# QueueProof baseline audit

Audit date: 3 August 2026. Baseline commit: `cafcd727acd18ce2828c49f0969d040ef6656395`.

## What was real

- Public Vercel product at `https://queueproof.vercel.app` with durable Turso storage.
- Four data-verified HydraDB connectors across GitHub, Linear, and Slack; Gmail also contained retrievable records.
- Public workspace access was an intentional deployment policy, not an authentication bypass.
- Claim-level synthesis, connector proof records, document ingestion, queue packets, MCP tokens, and approval proposals were already implemented.
- Release gates passed: lint, typecheck, 224 tests, build, deploy check, and 6/6 production showcase questions.

## Measured baseline

| Measure | Baseline |
| --- | ---: |
| Offline router mode agreement | 29/39 (74.4%) |
| Live showcase expected-answer pass | 6/6 |
| Live p50 | 778 ms in the audit rerun; 660 ms in the stored artifact |
| Flagship provider coverage | GitHub, Linear, Slack |
| Flagship HydraDB calls | 1 thinking query |
| Flagship cited claims | 4/4 |

## Defects found

- Seven visible desktop controls were below a 44 px interaction target.
- Navigation state was not addressable by URL; refresh/back could not restore the active surface.
- Queue sorting, benchmark filtering, source preview, receipt copying, and score-formula disclosure were absent.
- Multiple records about the same work could become duplicate queue items.
- Document receipts did not preserve page count or processing duration.
- The answer API exposed legacy camelCase claims instead of one explicit grounded contract.
- The router over-escalated stable single-source questions and missed several reasoning cues.
- Production configuration had no early fail-closed validator, and the redactor lacked Linear, QueueProof, Attio, credential-URL, and query-token patterns.

This audit is intentionally a before-state. Current results belong in `BENCHMARK_REPORT.md` and the proof documents in this directory.
