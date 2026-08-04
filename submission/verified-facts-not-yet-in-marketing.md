# QueueProof — claims that are not release evidence

Do not put these claims in the README, social posts, form answers, or demo unless a new
artifact independently verifies them against the published commit.

1. **“22/22 PDF cases.”** The fresh strict public-production baseline is 20/22 cases and
   53/56 required facts. It predates the final unpublished retrieval change.
2. **“Fast-mode p95 ≤1.5 seconds.”** Latency depends on external services. Report the
   measured sample and its scope, never an invented SLA.
3. **“Perfect live accuracy.”** The fresh six-question production diagnostic passed 1/6
   complete cases and 15/19 facts. Citations were complete and supported, but coverage
   was not perfect.
4. **General retrieval accuracy from the router suite.** The 39/39 result measures the
   deterministic route decision on one fixed labelled fixture set.
5. **HydraDB dollar cost.** QueueProof records relative query units because no verified
   billing conversion is available.
6. **“Production-ready,” “winner,” or “perfect.”** The release candidate is strongly
   tested; those words still overstate the evidence.
7. **A public GitHub submission.** The repository was last verified as private. Make it
   judge-accessible only with the owner’s explicit approval.
8. **A final deployed result.** The redesigned local release has not been published or
   remeasured in production yet.

Current measured release gates: 324 tests across 32 files; 39/39 router cases with 331
fixture assertions; passing lint, typecheck, production build, E2E shell contract, and
Sites binding check.
