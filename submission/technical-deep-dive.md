# QueueProof technical deep dive

QueueProof is organized around one invariant: evidence may inform an action, but it may not
silently expand authority.

## Retrieval

The planner routes each question through Fast, Auto, or Thinking before calling HydraDB. The
UI names these modes **Quick**, **Best**, and **Investigate / Deep check**. Exact identifiers
use text and hybrid lanes, then merge and deduplicate their evidence. Connector or document
evidence is accepted only through attributable lineage; provider-name coincidence is rejected.

## Synthesis and evaluation

Answers are grounded, partial, or abstained. Each supported claim references receipt IDs, and
multi-part questions declare missing facets. The strict grader checks every required fact,
resolves citations, validates claim text and provider against the excerpt, and applies frozen
provider and contradiction requirements. A fact match does not override a failed provider
requirement.

On measured production runtime `aed027879150e3e324b54c5ec2194d4d715c501e`, Auto passed
4/6 with 19/19 facts, forced Fast passed 4/6 with 19/19 facts, and forced Thinking passed 2/6
with 13/19 facts and one timeout. The product exposes the weaker run rather than hiding it.

## Decision and execution

Conflict-aware clustering keeps disjoint exact IDs separate. A versioned ranking policy creates
a **Task brief** in the UI; its canonical API/MCP object is the Execution Packet. It contains
score math, evidence, constraints, permissions, missing information, and a receipt hash.

Provider writes require an exact proposal, explicit approval, and a uniquely claimed execution
row before provider I/O. Execution is not claimed without a persisted provider response ID.

## Large-document path

The deterministic 346-page PDF core run passed 21/22 cases and 55/56 facts. All 22 core
questions resolved as Fast; beginning, middle, and end canaries passed; 84/84 claims were
supported by 69 citations. The separate cross-source extension remains REVIEW because it
retrieved the document plus GitHub but missed one additional non-document provider.

## Trust and release boundaries

Signed sessions, exact public-workspace selection, encrypted credentials, scoped and revocable
MCP tokens, server-side public-control guards, and idempotent proposal/execution rows make the
authority boundary explicit.

The metrics above describe measured runtime `aed02787`. The current main evidence build must
be verified separately through `/api/health/live` and `RELEASE_EVIDENCE.md`. The repository is
still private and the video URL is pending.

Read the canonical details in:

- [Architecture](../docs/ARCHITECTURE.md)
- [Security](../docs/SECURITY.md)
- [Evaluation methodology](../docs/EVALUATION_METHODOLOGY.md)
- [Large-PDF proof status](../docs/LARGE_PDF_PROOF.md)
