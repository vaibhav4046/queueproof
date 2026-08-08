# QueueProof judge-path smoke test

Use this after the deployed release is identified by `/api/health/live` and `/api/lab` binds
same-SHA artifacts. Reference metrics below were measured at release
`b930c816071b86ad9ac1cc846fc24a452d3aa4a7`; do not silently transfer them to another runtime —
read current values from **Proof tests**.

## The 60-second path

1. **0–7 seconds — thesis.** Show “Ask your work. Get the proof.”, the shared-workspace
   disclosure, working question box, and live source count.
2. **7–24 seconds — ask once.** Select **Quick** and run the AuthShield question. Quick maps to
   forced Fast; Best maps to Auto; Investigate/Deep check maps to Thinking.
3. **24–37 seconds — prove it.** Open a citation receipt. Show the source excerpt, provider,
   source ID, timestamp, disagreement, and missing information.
4. **37–49 seconds — decide.** Open **Today** and show the first Task brief: score components,
   constraints, evidence, acceptance criteria, permissions, and receipt hash.
5. **49–60 seconds — measured close.** Open **Proof tests**. Show the current Fast row (at
   `b930c81`: 7/8 strict, 25/25 facts), then the 346-page PDF core (at `b930c81`: 5/22 strict,
   56/56 facts). Keep REVIEW visible.

## Pass criteria

- Every control in the path works; Today is populated before recording.
- No application console error, failed internal request, or horizontal overflow.
- Mobile destinations remain reachable with at least 44 px touch targets.
- Keyboard focus returns after closing receipts; Escape closes dialogs.
- Reduced-motion mode preserves the complete product flow without auto-motion.
- No metric appears without its artifact and measured release identity.
- `/api/health/live` SHA matches the `/api/lab` artifact SHA.
- The repository opens signed out and the public video URL resolves.

## Measured boundaries to rehearse (release b930c81, no timeouts)

- Best/Auto: 7/8, 25/25, p50/p95 1,890/2,795 ms, 10 calls / 10 units, all eight routed Fast.
- Quick/Fast: 7/8, 25/25, p50/p95 1,796/2,347 ms, 10 calls / 10 units.
- Investigate/Thinking: 7/8, 25/25, p50/p95 9,595/16,710 ms, 18 calls / 34 units — same
  passes as Fast for 5.3x p50 and 3.4x units.
- Shared non-pass row (all modes): `post-mortem attribution cross-check` REVIEW — 3/3 facts,
  citation precision/completeness 1.0, fails strict relevance alone (0.667).
- PDF core: 5/22 strict, 56/56 facts, p50/p95 1,722/2,165 ms, 29 calls / 29 units, all 22
  routed Fast, `exactIdPass` and `documentReceipt` true on every row; 17 REVIEW rows fail
  strict relevance (mean 0.542 across the non-pass subset) from a claim-splitting artifact.
- PDF cross-source extension: REVIEW — recovers required facts (document plus GitHub) but
  misses one additional non-document provider and strict relevance; Linear and Slack appear
  without supporting citations. Reported separately from the core denominator.

## Status

- [x] Evidence build committed and deployed (verify SHA at `/api/health/live`).
- [ ] Production rehearsal completed against the deployed build.
- [x] Repository public — verify signed out before submitting.
- [ ] Final video uploaded and URL verified.
- [x] Final 60-second recording committed at `video/queueproof-demo-v2.mp4`.
