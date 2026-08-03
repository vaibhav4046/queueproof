# QueueProof technical deep dive

QueueProof is organized around one invariant: evidence may inform an action, but it may
not silently expand authority.

## Retrieval

The deterministic planner chooses fast or thinking mode before calling HydraDB. Exact
identifiers execute text and hybrid lanes concurrently, then merge/deduplicate their
sources and chunks. Evidence is accepted only through connector/resource lineage;
provider-name coincidence is rejected.

## Synthesis and evaluation

Answers are grounded, partial, or abstained. Each claim references receipt IDs, and
multi-part questions declare missing facets. The strict grader requires every fact,
resolves every citation, checks claim text and provider against the excerpt, and requires
two cited providers for a labelled contradiction.

## Decision and execution

Conflict-aware clustering keeps disjoint exact IDs separate. A pure ranking policy creates
an Execution Packet with score math, evidence, constraints, permissions, and a receipt
hash. Provider writes require an exact proposal, one approval row, and a uniquely claimed
execution row before provider I/O.

## Trust boundaries

Versioned signed sessions, exact public-workspace selection, encrypted credentials, MCP
audience enforcement, server-side public control guards, and a forward action-integrity
migration make the boundaries explicit and testable.

Read the canonical details in:

- [Architecture](../docs/ARCHITECTURE.md)
- [Security](../docs/SECURITY.md)
- [Evaluation methodology](../docs/EVALUATION_METHODOLOGY.md)
- [Large-PDF proof status](../docs/LARGE_PDF_PROOF.md)
