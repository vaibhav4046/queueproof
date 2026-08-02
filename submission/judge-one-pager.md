# QueueProof: judge one-pager

## Start with what the testing found

QueueProof's own evaluation suite scores its own product at **74.4 per cent** router mode
accuracy (29 of 39 ground-truth cases, 15 categories). That is the measured number, and it
is the number in the report. Categories where the router disagrees with the hand-written
label are printed alongside it rather than averaged away.

On its first real run the suite found a routing defect in QueueProof's own retrieval router,
and it found it in the demo's own headline question. `planRetrieval` short-circuited on any
exact identifier and returned `mode: "fast"` before evaluating a single multi-step signal.
So "Who filed BUG-123, which project are they working on, and what did they say about the
fix in Slack?" was routed to a single-pass lookup and could never have been answered: it
needs an actor, a project and a Slack thread across providers. Reasoning signals are now
computed before the identifier lane is chosen. The lane still runs text and hybrid retrieval
in parallel, but escalates to `thinking` when the surrounding question needs multi-step
reasoning. Fix in commit `360c176`, pinned by `tests/router-flagship.test.ts`: the BUG-123
question asserts `mode === "thinking"`, `exactParallel === true`,
`category === "exact_identifier"`, and a bare "Show me BUG-123" asserts `mode === "fast"`,
`exactParallel === true`. Both pass.

**This was not a score improvement and is not presented as one.** Aggregate router accuracy
stayed at 29/39 = 74.4 per cent. Under-escalations fell from 8 to 7 and over-escalations
rose from 2 to 3. What the suite bought was a specific, load-bearing defect found in the
demo's own flagship question, and a fix pinned by tests. The number did not move.

The third finding is the one that matters most. The ranking signals were **negation-blind**:
a Linear ticket reading "No customer impact" scored plus nine for customer consequence and
ranked second in the queue. That bug was not caught by a test and not caught by reading the
score. It was caught because the Decision Receipt explains itself in score component deltas,
so a plus nine sitting next to the words "No customer impact" was visible on its face. A
system that only emitted a number would have shipped it.

Five more bugs came from the same discipline: test against live services, not mocks. See
"Seven bugs" below.

## The problem

Agents can already execute. What they cannot do is justify which piece of work deserves
execution next, or defend that answer afterwards. Work evidence sits across tickets,
documents and messages. Priority claims are made in prose and are not reproducible.

## The Priority Compiler

QueueProof compiles a ranked queue out of retrieved evidence rather than asking a model for
an opinion. Scoring is a deterministic function over explicit components, so the same
evidence always produces the same order, and a policy change is a diff rather than a
vibe shift.

Verified on live production: queue generation from live evidence returned HTTP 200 with
three ranked items spanning both connected providers, each carrying real citations.

| Rank | Score | Provider | Item |
|---:|---:|---|---|
| 1 | 77 | linear | AuthShield authentication outage for Northwind |
| 2 | 67 | slack | Commitment to ship the AuthShield fix before 7 August |
| 3 | 58 | slack | Promised post-mortem with no Linear issue tracking it |

## The Action Gap

Item three is the case QueueProof exists for. It is a commitment made in Slack with no
ticket behind it: a promised post-mortem that exists in conversation and nowhere in the
work system. It was found in real evidence rather than written into a fixture. Work that
nobody tracks is work nobody prioritises, and it is invisible to any tool that only reads
the issue tracker.

The same two-provider evidence also surfaces contradictions instead of averaging over them.
Asked "Who escalated the AuthShield outage, what deadline did engineering commit to, and
does Linear agree?", retrieval returned 11 sources across both providers in `thinking` mode
in 4220 ms, and reported the disagreement rather than a blended answer:

- linear: "Billing migration deadline moved to 14 August"
- slack: "the Linear ticket still says 14 August, but finance confirmed today it is staying
  at 7 August. Linear is out of date."

A system that blended those would have answered 14 August with confidence and been wrong.

## Decision Receipts

Each queue item carries a receipt: the evidence it was built from with real source
citations, a receipt hash, and a why-above-number-two block computed from the differences
between score components. The receipt is the product surface that caught the negation bug.
It is not a post-hoc explanation of a score; it is the arithmetic that produced the score.

## Why HydraDB is indispensable here

QueueProof has no evidence of its own. It cannot rank anything until real work evidence is
retrievable, and HydraDB is what makes that retrievable across source kinds:

- **The provider catalogue is live, not hardcoded.** 61 real providers load with their real
  credential schemas. QueueProof does not ship a per-provider client; it reads the contract
  at runtime.
- **Ingestion is real.** A document uploaded through the product goes to HydraDB
  `/context/ingest`, is polled through `graph_creation` to `completed`, and lands at stage
  `indexed`. Verified with source id `5fa3cc1258f4d1380685120889e2e8f3`.
- **Connector proof is a protocol, not a saved credential.** Two providers went through
  create, discover, configure, sync, verify and only then reached stage `data_verified`.
  Linear: real team "Helios Robotics", resource type `linear_team`,
  `realObjectsRetrieved` = 5, five real source ids persisted in a verification record.
  Slack: resource `C0B462AK7U3` (#all-qyntra) in workspace `qyntra`,
  `realObjectsRetrieved` = 3, verification id
  `verify_87da58b8-9f1f-48d6-9c98-5f118ba9b93e`.
- **The protocol held under a real failure.** Slack discovery succeeded while sync returned
  nothing, because Slack does not return `conversations.history` until the bot is invited to
  the channel. That is Slack behaving correctly, not a connector defect. What matters is
  that QueueProof refused to report `data_verified` throughout, exactly as it had for
  Linear. The stage moved only when real objects came back.
- **Cross-source retrieval is the payoff.** One query returned 10 sources across ingested
  documents and Linear tickets (HEL-4, 5, 6, 7). A second, once Slack was verified, returned
  11 sources across Linear and Slack together. The queue is ranked over all of it at once.

## Seven bugs found by testing against live services

Every one of these was invisible to mocks:

1. HydraDB's multipart field is `documents`, not `file`.
2. The source id is nested one level deeper in HydraDB's response envelope. Uploads
   returned null and were untrackable.
3. Document status was polled against the workspace slug rather than the database the
   document was ingested into. Every poll returned 502.
4. `CREATE TABLE IF NOT EXISTS` silently skips new columns on an existing table. Uploads
   500'd until real column migrations were added.
5. Provider timestamps of the form `2026-08-01T22:20:43.520449+00:00` were rejected by
   zod's `.datetime()`. Queue generation 500'd for every workspace with a live connector.
6. Evidence pairing joined on chunk fields that do not exist, fell back to positional
   pairing, and attached excerpts to the wrong source.
7. Ranking signals were negation-blind, as above.

## What is verified on live production

<https://queueproof.vercel.app>

- Durable storage on Turso/libSQL, EU West. `/api/health/ready` returns 200 ready.
- HMAC-signed httpOnly session cookies. Nine attack variants return 401: spoofed identity
  header, Host-prefix bypass, no credentials, wrong token, garbage signature, payload swap
  with the signature kept, unsigned payload, expired but correctly signed, and
  unauthenticated route access. A valid session returns 200.
- HydraDB configured through the product UI, credential encrypted at rest, fingerprint
  `503f442f560614fc`.
- 61 real providers loaded live with real credential schemas.
- Document ingestion through the product to stage `indexed`.
- Linear and Slack connectors, both driven entirely through the product to stage
  `data_verified`.
- Cross-source retrieval returning 10 sources across documents and Linear, and 11 sources
  across Linear and Slack, the latter surfacing a genuine contradiction between providers.
- Queue generation, HTTP 200, three ranked items spanning both providers, with citations,
  receipt hashes and why-above-number-two explanations, including an untracked Slack
  commitment at rank three.
- 208 tests passing. Typecheck, lint and production build clean.

## Honest limitations

State these plainly. None is dressed up.

- **Gmail is not connected.** Google requires a passkey challenge to reach the App Passwords
  page, and that challenge needs a physical biometric or hardware gesture. It is blocked by
  the authentication mechanism, not by preference and not by missing code.
- **No real Linear issue has been created through the write path.** The approval-gated
  propose path is built and unit-tested against an injected fetch. It has not executed a
  real write.
- **MCP receipt-hash parity is unproven against an external client.** The hash is computed
  and persisted; no external MCP client has fetched the same receipt.
- **The 346-page ground-truth PDF has not been ingested into HydraDB.** It is deterministic
  (958,096 bytes, SHA-256 `c047a3d0...`, 22 planted facts) but it is an artefact, not an
  indexed source.
- **Citation precision, citation recall, latency percentiles, HydraDB call counts and cost
  are not measured.** No figure is estimated for any of them.
- **Memory, skills runtime, decision replay, execution leases and change-ledger diffing are
  not implemented.**
- **The repository is private** (github.com/vaibhav4046/queueproof). It needs access
  granting before a judge can read it.
