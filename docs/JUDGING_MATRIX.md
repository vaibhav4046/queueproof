# HydraDB hackathon judging matrix

| Criterion | Verifiable QueueProof evidence | 60-second demo moment |
| --- | --- | --- |
| Correctness | Grounded/partial/abstained contract; strict fact and citation grader; explicit missing information | Run the flagship question, then open a citation receipt |
| Cross-source reasoning | Four verified connectors; flagship GitHub + Linear + Slack answer; contradictions remain explicit | Point to provider coverage and tracked-state disagreement |
| Retrieval quality | Exact IDs execute text and hybrid lanes concurrently; sources merge/dedupe; strong connector/resource lineage | Show routing reason and retrieval receipt |
| Latency and cost | Receipts expose elapsed time, actual call count, and relative units; stored live sample is clearly labelled small | Open **Proof tests** and distinguish measured from unmeasured |
| Reproducibility | 39 labelled router cases, 331 assertions, deterministic 346-page PDF, 22 questions, 56 fact groups, and a step-through measured-run replay | Open **History**, expand the recorded proof-test replays, step through one stored run, then show the exact command |
| Trust and safety | Public sandbox guard, versioned signed sessions, encrypted credentials, approval gate, at-most-once execution | Show the sandbox notice and exact proposal payload |
| Developer experience | Same persisted packets across web/API/MCP; MCP scope, expiry, revocation, and audience enforcement | Open **Connect AI** and show the bounded contract |
| Product quality | Composer-first workspace, real routes, compact mobile navigation, interactive citations, focus-managed dialogs, and distinct result states | Resize to mobile and navigate without losing functionality |

## Release evidence

- [`RELEASE_EVIDENCE.md`](../RELEASE_EVIDENCE.md) is the canonical source for candidate SHA,
  deployment identity, release gates, and final sign-off. At the time of this document cleanup,
  the complete current-candidate gate run and production SHA match were not recorded.
- Stored fixture and live measurements remain valid only for the timestamp and release identity
  inside their machine-readable artifacts. They do not prove the current candidate.
- Test, security, and MCP totals must come from the immutable CI receipt for the submitted
  commit; do not copy a total from an earlier local or published release.
- The checked-in router artifact records 39/39 cases and 331 fixture-computable assertions. It
  proves deterministic planner/ranking behavior only and is not live accuracy.
- Final responsive QA must cover 320x568, 375x667, 390x844, 430x932, 768x1024,
  1024x768, 1280x800, 1440x900, 1920x1080, mobile landscape, 200% zoom,
  keyboard navigation, and reduced motion. The earlier Evidence Orbit capture is archived.
- Repeat the secret scan after the final candidate is assembled and link its receipt from
  `RELEASE_EVIDENCE.md`.

## Differentiator

Search products return snippets. QueueProof proves the transition from fragmented
evidence to a safe next action:

`connector proof -> grounded claims -> preserved conflicts -> deterministic priority -> approval-gated execution`

The receipt is not decorative. It explains which evidence entered the answer, which
score components moved the queue item, what remains unknown, and what permission is
required before a write.

## Honest limits

- The timestamped strict PDF baseline is 20/22 cases and 53/56 facts with complete citations;
  it does not embed a release SHA and is not called 22/22 or same-commit evidence.
- The historical six-query live sample is not a stable latency distribution or SLA.
- Public sandbox visitors cannot modify integration or external-provider state.
- A provider write is considered executed only when a provider response ID is stored.
