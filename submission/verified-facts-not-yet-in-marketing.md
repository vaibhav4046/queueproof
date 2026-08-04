# QueueProof — claims that are not release evidence

Do not put these claims in the README, social posts, form answers, or demo unless a new
artifact independently verifies them against the published commit.

1. **“22/22 PDF cases.”** The strict public-production baseline is 20/22 cases and
   53/56 required facts.
2. **“Fast-mode p95 ≤1.5 seconds.”** Latency depends on external services. Report the
   measured sample and its scope, never an invented SLA.
3. **“Perfect live case pass rate.”** The final six-question production diagnostic passed
   4/6 complete cases and matched 19/19 facts. Citations were complete and supported, but
   two frozen multi-provider requirements remained REVIEW.
4. **General retrieval accuracy from the router suite.** The 39/39 result measures the
   deterministic route decision on one fixed labelled fixture set.
5. **HydraDB dollar cost.** QueueProof records relative query units because no verified
   billing conversion is available.
6. **“Production-ready,” “winner,” or “perfect.”** The release is strongly tested; those
   words still overstate the evidence.
7. **A public GitHub submission.** Do not claim this until the repository URL opens in a
   signed-out browser and the submitted commit is visible.
8. **Guaranteed multi-provider retrieval.** A fact can be correct and fully cited while
   HydraDB returns only one provider for that query. Keep the two provider-coverage REVIEW
   cases visible.

The previous published release measured 330 tests across 35 files; 39/39 router cases with
331 fixture assertions; passing lint, typecheck, both production builds, E2E shell contract,
and deployment checks. Its historical release identity was:
`4510d3fe60b3c271a107f514c98c42d120c9929b`.
