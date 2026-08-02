# Submission form answers

Paste-ready. Every claim here is verified against live production. Anything not verified is
marked as such in the same sentence, not omitted.

---

## Product name

QueueProof

## One-line description

QueueProof compiles a defensible next-action queue from real work evidence retrieved
through HydraDB, and emits a Decision Receipt for every ranking: the evidence, a receipt
hash, and the score component deltas that put item one above item two.

## Live URL

https://queueproof.vercel.app

Storage is Turso/libSQL in EU West. `GET /api/health/ready` returns 200 ready.

## Repository URL

https://github.com/vaibhav4046/queueproof

**The repository is currently private.** Grant judge access or make it public before
submitting, otherwise this link is dead for the reviewer.

## Video URL

Record from `submission/60-second-script.md`. Every beat in that script is performable
against live production today. Do not record the beats listed under "requires connector
setup".

## Stack

Next.js and React, TypeScript, Zod contracts, Drizzle schema, Vitest. Durable storage on
Turso/libSQL. Retrieval, ingestion and the provider catalogue through HydraDB. An
authenticated, workspace-bound MCP endpoint. Sessions are HMAC-signed httpOnly cookies.
Provider credentials are encrypted at rest and the browser only ever sees a fingerprint.

## How does the project use HydraDB?

HydraDB is the evidence layer, and QueueProof cannot rank anything without it.

- **Live provider catalogue.** 61 real providers load at runtime with their real credential
  schemas. QueueProof ships no per-provider client; it reads the contract from HydraDB.
- **Document ingestion.** A file uploaded through the product is sent to HydraDB
  `/context/ingest`, polled through `graph_creation` to `completed`, and reaches stage
  `indexed`. Verified with source id `5fa3cc1258f4d1380685120889e2e8f3`.
- **Connector proof.** Two connectors were created, discovered, configured, synced and
  verified entirely through the product UI. Linear: discovery returned a real team, "Helios
  Robotics", resource type `linear_team`; verification reached stage `data_verified` with
  `realObjectsRetrieved` = 5 and five real source ids persisted. Slack: resource
  `C0B462AK7U3` (#all-qyntra) in workspace `qyntra`, stage `data_verified`,
  `realObjectsRetrieved` = 3, verification id
  `verify_87da58b8-9f1f-48d6-9c98-5f118ba9b93e`. "Connected" is never inferred from a saved
  credential. Slack proved that: discovery succeeded while sync returned nothing, because
  Slack does not return `conversations.history` until the bot is invited to the channel, and
  QueueProof refused to report `data_verified` for the whole of that period.
- **Cross-source retrieval.** One query returned 10 sources across ingested documents and
  Linear tickets (HEL-4, 5, 6, 7). A second returned 11 sources across Linear and Slack
  together, in `thinking` mode, in 4220 ms, and surfaced a contradiction rather than
  averaging over it: Linear said the billing migration deadline moved to 14 August, Slack
  said the Linear ticket still says 14 August but finance confirmed it is staying at
  7 August and Linear is out of date.

The HydraDB credential was configured through the product UI, is encrypted at rest, and
shows only as fingerprint `503f442f560614fc`.

## What is technically distinctive?

**Ranking is a compiler, not an opinion.** The score is a deterministic function over
explicit components, so the same evidence always produces the same order and a policy
change is a diff.

**Every ranking carries a Decision Receipt.** Evidence with real citations, a receipt hash,
and a why-above-number-two block computed from score component deltas. That receipt is not
decoration: it is what caught a real bug. Ranking signals were negation-blind, so a Linear
ticket reading "No customer impact" scored plus nine for customer consequence and ranked
second. Visible only because the receipt shows the arithmetic.

**Connection is a proof protocol.** A connector only reaches `data_verified` after a canary
query returns objects attributable to that provider.

**Writes stop at the approval gate.** The propose path records the payload and its evidence
and does not execute.

## What is verified working today, on live production?

- Durable storage, Turso/libSQL EU West. `/api/health/ready` returns 200 ready.
- Session authentication. Nine attack variants return 401: spoofed identity header,
  Host-prefix bypass, no credentials, wrong token, garbage signature, payload swap with the
  signature kept, unsigned payload, expired but correctly signed, and unauthenticated route
  access. A valid session returns 200.
- HydraDB configured through the product UI, credential encrypted at rest, fingerprint
  `503f442f560614fc`.
- 61 real providers loaded live with real credential schemas.
- Document ingestion through the product to stage `indexed`.
- Linear connector to stage `data_verified`, five real source ids persisted.
- Slack connector to stage `data_verified`, `realObjectsRetrieved` = 3, verification id
  `verify_87da58b8-9f1f-48d6-9c98-5f118ba9b93e`.
- Cross-source retrieval, 11 sources spanning both Linear and Slack, `thinking` mode,
  4220 ms, surfacing a genuine contradiction between the two providers.
- Queue generation from live evidence, HTTP 200, three ranked items spanning both providers
  with real citations, receipt hashes and why-above-number-two explanations. Final ranking:
  1. AuthShield authentication outage for Northwind, linear (77)
  2. Commitment to ship the AuthShield fix before 7 August, slack (67)
  3. Promised post-mortem with no Linear issue tracking it, slack (58)
- Rank three is an untracked commitment found in real evidence: a promise made in Slack with
  no ticket behind it.
- 208 tests passing. Typecheck, lint and production build clean.

## What did you measure?

39 ground-truth cases across 15 categories. **Router mode accuracy: 29/39 = 74.4 per cent,
measured.** Full breakdown in `BENCHMARK_REPORT.md`.

Citation precision, citation recall, latency percentiles, HydraDB call counts and cost are
**not measured**. No value is estimated for any of them. One end-to-end query was timed at
4220 ms; that is a single measurement, not a distribution, and must not be quoted as one.

## Biggest challenge

Testing against live services instead of mocks, which surfaced seven real bugs that mocks
would have hidden:

1. HydraDB's multipart field is `documents`, not `file`.
2. The source id is nested one level deeper in the response envelope, so uploads returned
   null ids and were untrackable.
3. Document status polled the workspace slug rather than the database the document was
   ingested into. Every poll returned 502.
4. `CREATE TABLE IF NOT EXISTS` silently skips new columns on an existing table. Uploads
   500'd until real column migrations were added.
5. Provider timestamps (`2026-08-01T22:20:43.520449+00:00`) were rejected by zod
   `.datetime()`, so queue generation 500'd for every workspace with a live connector.
6. Evidence pairing joined on chunk fields that do not exist, fell back to positional
   pairing, and attached excerpts to the wrong source.
7. Ranking signals were negation-blind. Caught only because the receipt explains itself in
   component deltas.

## What is not built or not verified?

Answer this honestly if asked, and volunteer it if not:

- **Gmail connector: not connected.** Google requires a passkey challenge to reach the App
  Passwords page, and that challenge needs a physical biometric or hardware gesture. It is
  blocked by the authentication mechanism, not by preference. Slack and Linear are both
  connected and verified.
- **Linear write execution: no real issue has been created.** The approval-gated path is
  built and unit-tested against an injected fetch only.
- **MCP receipt-hash parity against an external client: unproven.** The hash is computed
  and persisted; no external MCP client has fetched the same receipt.
- **The 346-page ground-truth PDF is not ingested into HydraDB.** It is generated
  deterministically (958,096 bytes, SHA-256
  `c047a3d09c45ecf97e3ed8e2115eda08ea0f6152206237955030f4304fa2ed93`, 22 planted facts)
  but it is an artefact, not an indexed source.
- **Not implemented:** memory, skills runtime, decision replay, execution leases,
  change-ledger diffing.

## Pre-submission checklist

- [ ] Repository access granted to judges, or made public.
- [ ] Video recorded from `submission/60-second-script.md`, gated beats excluded.
- [ ] Live URL loads and `/api/health/ready` still returns 200 on the day.
- [ ] No answer above edited to claim Gmail, a real Linear write, MCP receipt-hash parity,
      or an unmeasured metric.
