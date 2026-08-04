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
assertions. The full release suite passes 329 tests across 35 files, including 13 security
and 8 MCP tests, plus typecheck, lint, production build, E2E, and deployment checks. The
interface is verified across the release matrix with all seven destinations available
on mobile.

The public product is intentionally a shared evidence sandbox. It allows grounded
questions, queue inspection, and shared proposals, but disables credential changes,
connector control, uploads, MCP token administration, and external execution. The exact
public workspace is selected by configuration and ambiguous multi-workspace state fails
closed.

**Live product:** <https://queueproof.vercel.app>

**Direct judge demo:** <https://queueproof.vercel.app/demo>

**Method and boundaries:** <https://queueproof.vercel.app/method>

**Measured results and replay:** <https://queueproof.vercel.app/benchmarks>

**Repository:** <https://github.com/vaibhav4046/queueproof>

**Replay the deterministic benchmark:** `npm run benchmark:router`

## Evidence to quote

- Four last-observed production connectors at `data_verified`: GitHub, Gmail, Linear,
  and Slack.
- Flagship production answer with cited GitHub, Linear, and Slack evidence in one thinking
  query.
- 39/39 deterministic router cases; 331 assertions.
- 329 tests across 35 files; 13 security tests; 8 MCP tests.
- Zero secret-pattern matching files across the complete pre-release history and final
  release worktree.

## Boundaries to quote with equal prominence

- The final post-deploy strict PDF run passed 20/22 cases and recovered 53/56 facts with
  complete citations; both REVIEW cases and the cross-source provider miss stay visible.
- The stored six-query live run is a small historical sample, not an SLA.
- Relative cost units are reported; no HydraDB USD cost is invented.
- External execution is considered proven only after a provider response ID is persisted.
