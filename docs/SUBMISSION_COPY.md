# Submission copy

## QueueProof - One answer. Every system. Proven.

QueueProof is an evidence-backed control plane for autonomous work, built on HydraDB. It
connects work evidence across GitHub, Linear, Slack, Gmail, and uploaded documents;
retrieves the minimum context needed; preserves conflicts; and produces a cited answer
plus a deterministic next-action packet.

Every claim resolves to a receipt. Every retrieval exposes its routing reason, provider
coverage, HydraDB calls, and elapsed time. Every queue item exposes the versioned score
components, evidence, constraints, permissions, missing information, and receipt hash.
Agents can read the same packet through MCP, while an external write remains an exact
proposal until a human approves it and the database grants the one execution claim.

HydraDB is the evidence layer, not a logo integration. QueueProof discovers provider
contracts, scopes connectors, waits for sync, and promotes a connector to `data_verified`
only after a canary returns attributable records. Exact identifiers run text and hybrid
retrieval concurrently. Strong connector/resource lineage prevents evidence from being
credited merely because its provider name matches.

The current deterministic benchmark passes 39/39 labelled router cases and 331
assertions. The current local candidate passes 340 tests across 37 files, including the
security and MCP suites, plus typecheck and lint. Replace those counts with the final CI
receipt if the candidate changes; fresh build, E2E, deployment, and responsive checks remain
release gates.

The public product is intentionally a shared evidence sandbox. It allows grounded
questions, queue inspection, and shared proposals, but disables credential changes,
connector control, uploads, MCP token administration, and external execution. The exact
public workspace is selected by configuration and ambiguous multi-workspace state fails
closed.

**Live product:** <https://queueproof.vercel.app>

**Direct judge route:** <https://queueproof.vercel.app/>

**Method and boundaries:** <https://queueproof.vercel.app/method>

**Measured results and replay:** <https://queueproof.vercel.app/benchmarks>

**Repository:** <https://github.com/vaibhav4046/queueproof>

**Replay the deterministic benchmark:** `pnpm benchmark:router`

## Evidence to quote

- Four last-observed production connectors at `data_verified`: GitHub, Gmail, Linear,
  and Slack.
- Flagship production answer with cited GitHub, Linear, and Slack evidence in one thinking
  query.
- Final six-query production sample: 19/19 required facts, four of six complete case
  passes, 100% citation precision/completeness, zero unsupported claims, p50 16.294 s,
  and p95 29.877 s.
- 39/39 deterministic router cases; 331 assertions.
- Current local candidate: 340 tests across 37 files; use the final CI receipt at submission.
- Zero secret-pattern matching files across the complete pre-release history and final
  release worktree.

## Boundaries to quote with equal prominence

- The final post-deploy strict PDF run passed 20/22 cases and recovered 53/56 facts with
  complete citations; both REVIEW cases and the cross-source provider miss stay visible.
- The stored six-query live run is a small diagnostic sample, not an SLA. Two cases stay
  REVIEW because the returned receipts did not satisfy the frozen multi-provider rubric,
  even though all required answer facts were present.
- Relative cost units are reported; no HydraDB USD cost is invented.
- External execution is considered proven only after a provider response ID is persisted.
