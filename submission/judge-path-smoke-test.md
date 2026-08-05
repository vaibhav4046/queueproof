# QueueProof — judge-path smoke test

Use this as the post-deploy rehearsal checklist. Record timestamps beside each step when
the redesigned commit is published; until then, local browser QA and public-production
retrieval measurements remain separate artifacts.

## The 60-second path

1. **0–7 seconds — thesis.** The first viewport shows “Ask your work. Get the proof.”,
   the shared-workspace disclosure, the working question box, and the live source count.
2. **7–24 seconds — ask once.** Run the preloaded AuthShield question. The calm visual
   sequence reads Sources → Answer → Next step while QueueProof selects Fast or Deep check.
3. **24–37 seconds — prove it.** Open a citation receipt. Show the source excerpt,
   provider, source ID, timestamp, and any explicit disagreement or missing information.
4. **37–49 seconds — decide.** Open **Today** and show the deterministic score components,
   constraints, evidence, acceptance criteria, permissions, and receipt hash.
5. **49–56 seconds — protect the write.** Open **Review actions** and inspect the exact proposed
   Linear payload. Do not claim public execution.
6. **56–60 seconds — measured close.** Open **Proof tests** and show 39/39 labelled routes,
   331 fixture assertions, and the strict 20/22 PDF baseline with REVIEW rows visible.

## Pass criteria

- Every control in the path works; the query CTA focuses the real console.
- No application console error, failed internal request, or horizontal overflow.
- Six destinations remain available on mobile, with at least 44 px touch targets.
- Reduced-motion mode shows the complete text and static background without auto-motion.
- No metric appears without a receipt or versioned artifact.

## Status

- [x] Local responsive QA at 375, 390, 768, 1024, and 1440 px plus 844×390 landscape.
- [x] Local reduced-motion QA at 390×844 and 1440×900.
- [x] Local CTA, keyboard-focus, E2E, lint, typecheck, test, and build gates.
- [ ] Production rehearsal after the redesigned commit is explicitly published.
- [ ] Final 60-second recording and two-minute backup recording.
