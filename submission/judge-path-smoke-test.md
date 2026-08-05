# QueueProof judge-path smoke test

Use this after the current main evidence build is deployed and identified by
`/api/health/live`. Production metrics currently describe measured runtime
`aed027879150e3e324b54c5ec2194d4d715c501e`; do not silently transfer them to another runtime.

## The 60-second path

1. **0–7 seconds — thesis.** Show “Ask your work. Get the proof.”, the shared-workspace
   disclosure, working question box, and live source count.
2. **7–24 seconds — ask once.** Select **Quick** and run the AuthShield question. Quick maps to
   forced Fast; Best maps to Auto; Investigate/Deep check maps to Thinking.
3. **24–37 seconds — prove it.** Open a citation receipt. Show the source excerpt, provider,
   source ID, timestamp, disagreement, and missing information.
4. **37–49 seconds — decide.** Open **Today** and show the first Task brief: score components,
   constraints, evidence, acceptance criteria, permissions, and receipt hash.
5. **49–60 seconds — measured close.** Open **Proof tests**. Show Quick/Fast at 4/6 strict and
   19/19 facts, then the 346-page PDF core at 21/22 and 55/56 facts. Keep REVIEW visible.

## Pass criteria

- Every control in the path works; Today is populated before recording.
- No application console error, failed internal request, or horizontal overflow.
- Mobile destinations remain reachable with at least 44 px touch targets.
- Keyboard focus returns after closing receipts; Escape closes dialogs.
- Reduced-motion mode preserves the complete product flow without auto-motion.
- No metric appears without its artifact and measured runtime identity.
- `/api/health/live` identifies the deployed evidence build.
- The repository opens signed out and the public video URL resolves.

## Measured boundaries to rehearse

- Best/Auto: 4/6, 19/19, p50/p95 2,155/2,392 ms, 7 calls / 7 units, all Fast.
- Quick/Fast: 4/6, 19/19, p50/p95 1,833/2,446 ms, 7 calls / 7 units.
- Investigate/Thinking: 2/6, 13/19, p50/p95 26,329/40,003 ms, 10 calls / 30 units,
  including one timeout.
- PDF core: 21/22, 55/56, p50/p95 1,823/2,382 ms, 31 calls / 31 units, all 22 Fast,
  beginning/middle/end canaries passed, 84/84 claims supported by 69 citations.
- PDF cross-source extension: REVIEW, 2/2 facts, document plus GitHub, one additional
  non-document provider missing, 29,676 ms, 6 calls / 18 units.

## Status

- [ ] Current main evidence build committed and deployed.
- [ ] Production rehearsal completed against that build.
- [ ] Repository made public and verified signed out.
- [ ] Final video uploaded and URL verified.
- [ ] Final 60-second recording and two-minute backup recording completed.
