# QueueProof judge Q&A

## What is QueueProof?

QueueProof is a daily evidence workspace. It retrieves work context through HydraDB, returns a
concise answer with claim-level receipts, preserves disagreement and missing proof, and compiles a
reviewable next-action packet.

## Why is this more than semantic search?

Questions can require exact identifiers, actors, temporal ordering, changed state, provider
requirements, contradictions, and multiple hops. QueueProof plans Fast/Thinking retrieval,
validates source lineage, checks requested facets, and refuses unsupported completion.

## How central is HydraDB?

HydraDB supplies the provider catalogue/lifecycle, connector-backed retrieval, and document
indexing. QueueProof records HydraDB request IDs, modes, latency, calls, provider coverage, and
source identities. Without HydraDB evidence, the cross-source answer path has nothing to ground.

## Do you really have three connectors?

Count the current **Sources** receipts during judging. A connector qualifies only when authentication
and a real read produced attributable records and QueueProof stored the verification state. Do not
count historical, degraded, or credential-only rows. The final report must name the exact current
three or more; until then the claim is pending current receipt.

## How do you know a citation supports a claim?

The strict grader resolves citation IDs, compares the claim/provider with the normalized excerpt,
and applies required-fact, required-provider, completeness, unsupported-claim, and contradiction
checks. A provider badge without a supporting cited claim does not count.

## What happens when sources disagree?

QueueProof retains both source statements, names the contradiction, and avoids collapsing them into
one confident answer. A contradiction benchmark passes only when cited support exists on both
sides.

## What happens when evidence is missing?

The result is partial or abstained, with missing facets named. Rejected retrieval candidates are
shown as insufficient rather than promoted to proof. That may reduce a strict pass rate, but it is
the intended trust boundary.

## Why Fast and Thinking?

Fast is cheaper and lower latency for simpler retrieval. Thinking is reserved for deeper questions.
QueueProof measures both on frozen cases and compares them only when the case order, target, and
release match. The final measured result may show Thinking underperforming; it will remain visible.

## What does “cost” mean here?

HydraDB calls and weighted query units represent relative retrieval work. QueueProof does not claim
those units are dollars because no verified billing conversion is part of the receipt.

## Is the benchmark an accuracy guarantee?

No. It is a small, frozen release diagnostic. Report strict pass count, fact recall, citations,
latency, calls, and failures separately. The offline router suite proves deterministic routing and
ranking only, not live answer accuracy.

## What is the large-document proof?

A deterministic 346-page handbook is ingested with checksum, page count, and HydraDB source ID.
The frozen suite probes beginning/middle/end canaries, exact IDs, tables, superseded policy,
multilingual passages, distractors, and a separately reported document-plus-connectors question.
Exact current results come from the same-SHA PDF artifact.

## Can an AI agent change Linear or another provider?

Not directly. MCP can create only a bounded, evidence-linked Linear `create_issue` proposal when
its token has proposal scope. There is no MCP approve or execute tool. An owner approves through
the web control plane, and execution counts only after the provider response ID is stored.

## How is MCP secured?

Bearer tokens are hashed, workspace-bound, scoped, expiring, revocable, and audience-restricted.
Anonymous, invalid, expired, revoked, and wrong-audience requests fail closed. Retrieved text is
untrusted evidence. Supabase OAuth is claimed only when the external issuer/client consent flow
and a current-release read-only ChatGPT tool call are recorded and tested end to end.

## Does it work in Claude and Codex?

The repository contains tested config shapes and a CLI verifier for Claude Code and Codex. Claude
also supports remote custom connectors, but QueueProof claims only the client surfaces proven by a
current authenticated read receipt. Say **configured**, **connected**, or **verified workflow** only
according to that receipt; bearer configuration alone is not a Claude web connection.

## How is the release reproducible?

Health exposes the exact production SHA/ref, deployment ID/timestamp, and grader version. Lab
accepts benchmark artifacts only for that SHA. The repository publishes deterministic setup,
typecheck, lint, test, router, build, deploy check, route gate, and live benchmark commands.

## What are the honest limitations?

- Connector availability can change and must be reverified.
- The live sample is small and not an SLA.
- `REVIEW` and timeouts remain failures.
- Relative units are not USD.
- A named MCP client needs a live authenticated receipt.
- Repository publication and video upload require owner action.

## Why should this win?

Judges should decide from the receipts: cross-source answers that remain inspectable, an explicit
latency/accuracy/work tradeoff, a real document benchmark, reproducible release identity, and a
write boundary that does not turn retrieved text into authority. QueueProof does not claim a win or
a perfect score in advance.
