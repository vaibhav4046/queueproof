# QueueProof — judge-path smoke test

Canonical story executed against **production** (`https://queueproof.vercel.app`)
after the release deploy. Each step lists the exact click/keystroke, the expected
visible evidence, and the pass criterion. This file is the rehearsal checklist —
record timestamps and results beside each step when the run is executed.

## The 60-second path
1. **0-6 s — thesis.** Landing shows "One answer. Every system. Proven." with
   `Public sandbox` disclosure and four verified connector receipts in the rail.
2. **6-14 s — connector + PDF proof.** Evidence tab shows GitHub (canary ≥1),
   Linear (≥5), Slack (≥3), Gmail (≥4) `data_verified` connectors, and the
   indexed 346-page synthetic PDF with its receipt (doc_44fe0aac…, source
   f64d374d…, indexed, human-readable duration).
3. **14-31 s — flagship query.** Proof tab → run the flagship AuthShield question.
   Watch the Evidence Orbit: routing ring → provider routes pulse → receipts
   arrive → facets converge → core locks. Answer arrives with inline citation
   chips and a retrieval receipt (mode, HydraDB calls, latency, provider
   coverage, receipt count, cost units).
4. **31-42 s — citations + contradiction.** Click citation chips (focus trap,
   Escape, focus restore). Open the GitHub-versus-Linear open/merged
   contradiction if present.
5. **42-50 s — priority action.** Queue tab → hero packet with deterministic
   score breakdown, why-now, penalties, confidence, safe next action, approval
   requirement.
6. **50-57 s — receipts + benchmark.** Open the retrieval receipt; Benchmarks
   tab shows versioned strict-grader artifact (required facts, mode, calls,
   latency, cost) with failed cases visible.
7. **57-60 s — close.** Live URL and repository link (public GitHub only after
   visibility change is approved).

## Pass criteria
- Every click works within the allotted time; no dead controls.
- No console errors, no failed internal requests, no horizontal overflow.
- No metric shown without a receipt/artifact behind it.

## Status
- [ ] Desktop rehearsal on production (blocked on deploy).
- [ ] Mobile rehearsal (360×390) — orbit hidden, rail as receipt strip.
- [ ] Two-to-three-minute backup demo recorded (slower walkthrough).
