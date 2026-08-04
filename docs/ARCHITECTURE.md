# QueueProof architecture

QueueProof is an evidence control plane over HydraDB. It turns cross-system evidence into
a cited answer and a deterministic, approval-safe next action.

```text
Web / JSON API / MCP client
            |
     server-resolved actor
            |
 durable workspace (Turso/libSQL)
            |
 encrypted HydraDB account credential
            |
 verified connector scopes + indexed documents
            |
 deterministic query planner
            |
 fast/thinking retrieval (+ exact-ID text and hybrid lanes)
            |
 strong connector/resource lineage + source/chunk join
            |
 grounded / partial / abstained answer contract
            |
 conflict-aware task clustering + deterministic ranking
            |
 immutable Execution Packet and receipt hash
            |
 proposal -> approval -> at-most-once provider execution
```

## 1. Identity and workspace boundary

The server resolves an actor from one of four explicit paths: a versioned HMAC-signed
session, a configured trusted identity gateway, an opted-in non-production local actor, or
the opted-in public demo actor. Caller-provided workspace IDs do not select operational
rows.

Public demo mode is a shared evidence sandbox. Reads, grounded questions, queue review,
and shared proposals remain available. Credentials, connector lifecycle mutations,
database creation, uploads, MCP token administration, and external execution call a
private-actor guard and return 403 for the public actor.

Raw database enumeration/querying, workspace creation, and ingestion-status refresh are
also owner-only because they cross the evidence/control boundary. Public ask, queue, and
proposal operations use durable per-workspace throttles (12/minute, 3/5 minutes, and
8/10 minutes respectively), and the shared proposal ledger caps pending rows at 50.

`QUEUEPROOF_PUBLIC_WORKSPACE_ID` selects the exact shared workspace. If it is absent, a
singleton fallback succeeds only when exactly one workspace exists; multiple workspaces
are ambiguous and fail closed.

## 2. Connector proof and lineage

A configured credential is not proof of usable data. A connector progresses through
discovery, resource scoping, sync, and canary verification. Only `data_verified`
connectors enter retrieval and queue generation.

Retrieved sources must belong to the expected HydraDB connector or one of its selected
resource IDs. Provider-name equality alone is insufficient. Uploaded-document evidence
must match the requested HydraDB source ID. Source excerpts join to chunks through
HydraDB identities, never array position.

## 3. Retrieval planning

`packages/retrieval` classifies the question and chooses `fast` or `thinking`, graph
context, recency bias, and a query lane. Exact identifiers are special: QueueProof runs
both `text` and `hybrid` retrieval concurrently so lexical precision does not sacrifice
aliases or semantic context. Routes record both calls, merge their responses, and
deduplicate sources and chunks.

Reasoning signals are evaluated before the exact-ID lane is selected. An ID-only lookup
can remain fast; an ID embedded in a cross-source or multi-step question escalates to
thinking while retaining both retrieval lanes.

## 4. Grounded synthesis

The synthesis contract returns answer text, claim records, citations, contradictions,
missing information, a recommended agent, retrieval trace, and validation status.
Multi-part questions are checked for facet coverage, including actor, commitment,
completion state, date/deadline, filing actor, and project association.

- `grounded`: requested facets are covered and claims cite evidence.
- `partial`: supported claims exist, but one or more requested facets remain missing.
- `abstained`: evidence is insufficient; the answer begins with an explicit insufficient-
  evidence statement.

Contradictions stay visible. Retrieved instructions are treated as untrusted data and
prompt-injection-shaped evidence is excluded from the action queue.

## 5. Queue compilation

QueueProof clusters records before ranking. Records with overlapping exact IDs form one
component. An ID-less entity record attaches only when it matches exactly one exact-ID
component. Records with disjoint exact-ID sets are never merged merely because their
product names look similar.

The ranking package is deterministic and versioned. Each persisted Execution Packet
contains the objective, evidence, constraints, dependencies, acceptance criteria,
permissions, component scores, penalties, missing information, and receipt hash.

## 6. Action control plane

Writes are split into proposal, approval, execution, and provider confirmation.

- Proposal idempotency is scoped by workspace.
- The forward migration normalizes historical approvals/executions and enforces one
  approval and one execution row per proposal.
- The execution row is claimed before provider I/O, so concurrent approvals cannot create
  two issues.
- Success is reported only after the provider returns an issue ID; failures are persisted.
- Approval revalidates owner role, Linear action type, payload bounds, workspace evidence,
  and evidence IDs embedded in the provider description before claiming execution.

## 7. MCP

MCP reads the same persisted packets used by the web and API surfaces. Tokens are stored
as hashes, carry scopes, expiry, revocation state, and an audience. The endpoint rejects a
valid token issued for any audience other than `queueproof-mcp`.

The propose scope is not a generic write escape hatch: it can only create a Linear
`create_issue` proposal, every evidence ID must already belong to the token workspace,
and the exact provider payload must carry those IDs. Execution still requires a separate
owner approval through the web control plane.

## 8. Persistence and runtime

Production uses Turso/libSQL through a D1-compatible facade. Local and CI runs use Node
SQLite. QueueProof refuses a silent ephemeral fallback unless explicitly configured for
tests. Schema integrity is represented in Drizzle migrations, including the action
execution forward migration.

## 9. Product surface

The app exposes real routes for Ask, Priorities, Evidence, Benchmarks, Replay, Approvals,
and Developer. The compact mobile navigation keeps the four primary destinations visible
and puts the remaining routes behind a labelled More control. The header remains sticky,
result status is announced accessibly, citations open receipt dialogs, and modal/drawer focus
is contained and restored.

Release QA must cover 320x568, 375x667, 390x844, 430x932, 768x1024, 1024x768,
1280x800, 1440x900, 1920x1080, mobile landscape, 200% zoom, keyboard navigation, and
reduced motion. Historical Evidence Orbit/WebGL captures are not proof of the final design.
