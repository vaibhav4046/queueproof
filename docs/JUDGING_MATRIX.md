# HydraDB hackathon judging matrix

| Criterion | Verifiable QueueProof evidence | 60-second demo moment |
| --- | --- | --- |
| Correctness | Grounded/partial/abstained contract; strict fact and citation grader; explicit missing information | Run the flagship question, then open a citation receipt |
| Cross-source reasoning | Four verified connectors; flagship GitHub + Linear + Slack answer; contradictions remain explicit | Point to provider coverage and tracked-state disagreement |
| Retrieval quality | Exact IDs execute text and hybrid lanes concurrently; sources merge/dedupe; strong connector/resource lineage | Show routing reason and retrieval receipt |
| Latency and cost | Receipts expose elapsed time, actual call count, and relative units; stored live sample is clearly labelled small | Open Benchmarks and distinguish measured from unmeasured |
| Reproducibility | 39 labelled router cases, 331 assertions, deterministic 346-page PDF, 22 questions, 56 fact groups, and a step-through measured-run replay | Open Replay, step through one stored run, then show the exact command |
| Trust and safety | Public sandbox guard, versioned signed sessions, encrypted credentials, approval gate, at-most-once execution | Show the sandbox notice and exact proposal payload |
| Developer experience | Same persisted packets across web/API/MCP; MCP scope, expiry, revocation, and audience enforcement | Open Developer and show the bounded contract |
| Product quality | Proof-first first viewport, seven mobile destinations, interactive citations, evidence timeline, promised-versus-actual table, focus-managed dialogs, distinct result states | Resize to mobile and navigate without losing functionality |

## Release evidence

- Typecheck, lint, production build, E2E, and deployment check: pass.
- Full suite: 329 tests across 35 files.
- Security suite: 13 tests.
- MCP suite: 8 tests.
- Router benchmark: 39/39 cases, 331 assertions.
- Responsive QA: 320x568, 375x667, 390x844, 430x932, 768x1024, 1024x768,
  1280x800, 1440x900, 1920x1080, mobile landscape, 200% zoom, reduced motion,
  and WebGL fallback.
- Secret scan: zero matching files across the final worktree and complete pre-release history.

## Differentiator

Search products return snippets. QueueProof proves the transition from fragmented
evidence to a safe next action:

`connector proof -> grounded claims -> preserved conflicts -> deterministic priority -> approval-gated execution`

The receipt is not decorative. It explains which evidence entered the answer, which
score components moved the queue item, what remains unknown, and what permission is
required before a write.

## Honest limits

- The fresh strict PDF baseline is 20/22 cases and 53/56 facts with complete citations;
  it is the final post-deploy result and is not called 22/22.
- The historical six-query live sample is not a stable latency distribution or SLA.
- Public sandbox visitors cannot modify integration or external-provider state.
- A provider write is considered executed only when a provider response ID is stored.
