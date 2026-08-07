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

The server resolves an actor in strict trust order: verified Supabase session, versioned HMAC-signed
legacy owner session, configured trusted identity gateway, opted-in non-production local actor,
then the opted-in public demo actor. Supabase identity is the pinned issuer plus immutable `sub`;
email is mutable profile data and never a tenant key. A subject is provisioned exactly one
deterministic personal workspace, and ambiguous membership fails closed. Caller-provided
workspace IDs do not select operational rows. Production Supabase deployments disable the legacy
owner secret, and direct Vercel deployments reject the OpenAI Sites header-trust mode.

Public demo mode is a shared evidence sandbox. Reads, grounded questions, and queue review
remain available. Credentials, connector lifecycle mutations, proposals,
database creation, uploads, MCP token administration, and external execution call a
private-actor guard and return 403 for the public actor.

Anonymous read responses cross a second, response-time DTO boundary. QueueProof keeps curated
titles, excerpts, providers, timestamps, ranking reasons and readiness states, but removes raw
workspace/database/collection/Hydra identifiers, hashes, arbitrary metadata and provider errors.
Storage references needed for list-to-detail navigation are replaced with stable, workspace-scoped
public references, and provider URLs are null because even an HTTPS permalink may be private or
signed. This projection is applied after loading persisted JSON so legacy receipts cannot bypass
the current boundary; signed-in private actors retain the full operational DTO.

Raw database enumeration/querying, workspace creation, and ingestion-status refresh are
also owner-only because they cross the evidence/control boundary. Public ask and queue
operations use durable per-workspace throttles (12/minute and 3/5 minutes respectively).
Proposal creation and history, approval, and execution remain owner-only; the shared demo
never exposes that control plane.

`QUEUEPROOF_PUBLIC_WORKSPACE_ID` selects the exact shared workspace, and that workspace must
have an explicit membership for `user:public-access`. If either the selector or membership is
absent, public resolution fails closed. QueueProof never treats a singleton workspace as public;
it could be a signed-in user's private tenant on a fresh or misconfigured deployment. Deployment
settings select the workspace but never create or elevate membership as a side effect of a read.
An operator persists the fixed non-owner `member` assignment once with the offline
`public:provision` command against an exact existing workspace. The command uses one transactional
batch and is not imported by request handling.

## 2. Connector proof and lineage

A configured credential is not proof of usable data. A connector progresses through
discovery, resource scoping, sync, and canary verification. Only `data_verified`
connectors enter retrieval and queue generation.

An attached HydraDB account may expose connector references that already exist upstream.
QueueProof lists those references only after an authenticated, account-scoped HydraDB call and
re-fetches that list before importing selected IDs. Provider, database, collection, and account
scope come from HydraDB rather than the browser. Import proves only that the attached account can
access the connector: the local row starts at `connector_created` and still must pass resource
scoping and the QueueProof canary before retrieval can use it. A new Slack, Gmail, or other
provider connection still requires that provider's HydraDB OAuth or credential flow.

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

MCP reads the same persisted packets used by the web and API surfaces. Legacy tokens are stored
as hashes and carry scopes, expiry, revocation state, and an audience. In OAuth mode QueueProof is
the resource server: it verifies Supabase ES256/RS256 OAuth tokens against a configuration-pinned
JWKS, issuer, canonical `/mcp` audience/resource, lifetime, subject, and OAuth `client_id`, then resolves
that subject to its one personal workspace. A JWT-shaped credential never falls through to the
legacy token path.

MCP search accepts only QueueProof connectorIds or indexed document sourceIds. It resolves the
HydraDB database and collection server-side, sends one connector-lineage-filtered query per
connector (or one exact-ID query per document database), and drops every returned source that
cannot be attributed back to the requested connector/resource or document ID.

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

The app exposes real routes labelled Ask, Today, Sources, Proof tests, History, Review actions,
and Connect AI. The compact mobile navigation keeps the four primary destinations visible
and puts the remaining routes behind a labelled More control. The header remains sticky,
result status is announced accessibly, citations open receipt dialogs, and modal/drawer focus
is contained and restored.

Release QA must cover 320x568, 375x667, 390x844, 430x932, 768x1024, 1024x768,
1280x800, 1440x900, 1920x1080, mobile landscape, 200% zoom, keyboard navigation, and
reduced motion. Historical Evidence Orbit/WebGL captures are not proof of the final design.
