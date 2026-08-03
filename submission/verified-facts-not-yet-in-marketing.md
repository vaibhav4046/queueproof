# QueueProof — facts that must NOT appear in marketing until independently verified

These claims are NOT currently backed by a fresh production measurement. Do not
put them in the README, social posts, form answers, or the demo without first
verifying each one.

1. **"22/22 PDF facts"** — the strict grader measured 16/22 (rate-limit fixed).
   The synthesis fix is implemented and locally tested; 22/22 is a TARGET until
   the fix is deployed and `npm run benchmark:pdf` passes on production.
2. **"21/22 PDF facts"** — that number came from the legacy token-recall grader
   and predates `grounded-grader-v2`; it is historical, not current.
3. **"PDF canary recall ≥90%"** — the last strict run had beginning/middle pass
   and end REVIEW (rate-limited rows); not a clean ≥90% measurement.
4. **"Fast-mode p95 ≤1.5 s"** — external-condition-dependent; strict-run p95 was
   4007 ms (includes first-run cold latency). Report measured latency only.
5. **"6-question accuracy"** — the six-question live set is a small historical
   sample and passes only permissive checks; it is not universal accuracy.
6. **Router accuracy** — `benchmark:router` is 39/39 on the fixed labelled set
   (deterministic layer). Do not phrase this as general retrieval accuracy.
7. **"274 tests"** — the current suite is 280 tests across 29 files; recompute
   before quoting any test count.
8. **Any "not indexed" / "unverified Gmail" phrasing** — stale docs claim
   Gmail unverified; production shows 4 `data_verified` connectors (Gmail canary 4).
9. **"Production-ready" / "winner" / "perfect"** — never claim without
   independently reproducible evidence from the shipped production commit.
10. **Public GitHub link in the demo** — only after the repository visibility
    change is approved and a clean secret scan is recorded.
