# QueueProof benchmark report

Measured values only. Every number below was produced by a runner or observed on live
production. Nothing is estimated, interpolated, rounded in the product's favour, or carried
over from a previous run. Metrics that were not measured are listed as not measured, with
the reason.

Evaluation runner: `node scripts/run-evals.mjs`
Fixtures: `evals/fixtures/cases.json` (39 ground-truth cases, fictional company "Helios
Robotics")
Runner artefacts: `evals/results/results.json`, `evals/results/results.csv`
(generated 2026-08-01T20:14)

---

## 1. Evaluation suite: router mode accuracy

**29 / 39 = 74.4 per cent.**

This compares `planRetrieval(question).mode` against the hand-labelled `expected.mode` for
each case. The label was written from the question, not copied from the router, so a
mismatch is a real routing disagreement rather than a tautology.

| Category | Cases | Router mode correct | Accuracy |
| --- | ---: | ---: | ---: |
| exact-id | 3 | 2 | 66.7% |
| actor | 3 | 3 | 100.0% |
| thread | 2 | 2 | 100.0% |
| temporal | 3 | 3 | 100.0% |
| metadata | 3 | 1 | 33.3% |
| entity-dedup | 2 | 0 | 0.0% |
| knowledge-update | 2 | 1 | 50.0% |
| attribution | 3 | 2 | 66.7% |
| multilingual | 3 | 2 | 66.7% |
| multi-hop | 2 | 2 | 100.0% |
| conflict | 2 | 2 | 100.0% |
| priority | 3 | 1 | 33.3% |
| counterfactual | 2 | 2 | 100.0% |
| adversarial | 3 | 3 | 100.0% |
| large-pdf | 3 | 3 | 100.0% |
| **all** | **39** | **29** | **74.4%** |

The weak categories are printed rather than averaged away. `entity-dedup` at 0 per cent and
`metadata` and `priority` at 33.3 per cent are the measured result.

### Escalation behaviour

| Measure | Value |
| --- | ---: |
| Predicted fast / thinking | 18 / 21 |
| Expected fast / thinking | 14 / 25 |
| Escalations to thinking | 21 |
| Over-escalated (expected fast, got thinking) | 3 |
| Under-escalated (expected thinking, got fast) | 7 |

### Fixture assertions

All 325 fixture-computable assertions passed.

---

## 2. Live production observations

Observed against <https://queueproof.vercel.app>. Each line is a run that was performed and
whose result was read, not a capability inferred from source code.

| Observation | Measured result |
| --- | --- |
| Storage | Turso/libSQL, EU West |
| `GET /api/health/ready` | 200, ready |
| Session attack variants returning 401 | 9 of 9 (spoofed identity header, Host-prefix bypass, no credentials, wrong token, garbage signature, payload swap with signature kept, unsigned payload, expired but correctly signed, unauthenticated route access) |
| Valid session | 200 |
| HydraDB credential fingerprint | `503f442f560614fc` (configured through the product UI, encrypted at rest) |
| Providers loaded live with real credential schemas | 61 |
| Document ingestion, product to HydraDB `/context/ingest`, polled `graph_creation` to `completed` | stage `indexed`, source id `5fa3cc1258f4d1380685120889e2e8f3` |
| Linear connector, driven entirely through the product | stage `data_verified`, `configured=1`, discovery returned real team "Helios Robotics" (resource type `linear_team`) |
| `realObjectsRetrieved` on Linear verification | 5, with five real source ids persisted in a verification record |
| `providerCoverage` | `["linear"]` |
| Cross-source retrieval, single query | 10 sources: 6 ingested documents and 4 Linear tickets (HEL-4, HEL-5, HEL-6, HEL-7) |
| Queue generation from live evidence | HTTP 200, 3 ranked items with real Linear citations, receipt hashes and why-above-#2 explanations computed from score component deltas |

### Final ranking produced from live evidence

| Rank | Item | Score |
| ---: | --- | ---: |
| 1 | AuthShield authentication outage for Northwind | 77 |
| 2 | Billing migration deadline | 47 |
| 3 | Rover SDK docs refresh | 35 |

---

## 3. Ranking cases in the evaluation suite

Three cases declare an expected top task. Each builds real `RankingInput` objects, validates
them against `rankingInputSchema`, and calls the real `rank()`.

- `prio-01`: expected `task-atlas-blocker`, got `task-atlas-blocker`. PASS
  (order: task-atlas-blocker=82, task-vega-polish=23)
- `prio-02`: expected `task-bug123-fix`, got `task-bug123-fix`. PASS
  (order: task-bug123-fix=73, task-nimbus-oncall=46, task-doc-refresh=13)
- `prio-03`: expected `task-northwind-sla`, got `task-northwind-sla`. PASS
  (order: task-northwind-sla=72, task-kestrel-contract=38, task-internal-tooling=24,
  task-vega-shipped=0)

---

## 4. Deterministic artefact

The 346-page ground-truth PDF is byte-identical across runs.

| Measure | Value |
| --- | --- |
| Pages | 346 |
| Size | 958,096 bytes |
| SHA-256 | `c047a3d09c45ecf97e3ed8e2115eda08ea0f6152206237955030f4304fa2ed93` |
| Determinism | Identical hash across runs |
| Planted ground-truth facts | 22 |

**This PDF has not been ingested into HydraDB.** It is a deterministic artefact, not an
indexed source, and no retrieval metric below or above is derived from it.

---

## 5. Engineering gates

| Gate | Result |
| --- | --- |
| Tests | 208 passing |
| Typecheck | clean |
| Lint | clean |
| Production build | clean |

Passing tests are not offered as evidence of live behaviour. The live claims in section 2
stand on their own runs.

---

## 6. Not measured

Absent by design. No value is guessed for any of these, and none may be quoted in the
submission.

| Metric | Status | Why not |
| --- | --- | --- |
| Citation precision | not measured | Requires a human-labelled citation key over the indexed corpus. None exists. |
| Citation recall | not measured | Requires the full set of correct sources per question. Not labelled. |
| End-to-end latency, including percentiles | not measured | No timed round-trip series was collected against the deployment. |
| HydraDB call count per query | not measured | Not instrumented and not counted during the live runs. |
| Cost per query | not measured | Derived from provider and HydraDB usage, which was not metered. |
| Retrieval quality over the 346-page PDF | not measured | The PDF was never ingested, so no retrieval ran against it. |
| Slack and Gmail connector behaviour | not measured | Not connected. Requires the owner's own provider logins. |
| Real Linear write execution | not measured | The approval-gated path is unit-tested against an injected fetch only. No real issue has been created. |
| MCP receipt-hash parity against an external client | not measured | The hash is computed and persisted, but no external MCP client has fetched the same receipt. |

---

## 7. Bugs found by testing against live services

Recorded here because they are measurement results too: each was invisible to mocks and
surfaced only when the code met the real service.

1. HydraDB's multipart field is `documents`, not `file`.
2. The source id is nested one level deeper in HydraDB's response envelope. Uploads
   returned null and were untrackable.
3. Document status was polled against the workspace slug rather than the database the
   document was ingested into. Every poll returned 502.
4. `CREATE TABLE IF NOT EXISTS` silently skips new columns on an existing table. Uploads
   500'd until real column migrations were added.
5. Provider timestamps of the form `2026-08-01T22:20:43.520449+00:00` were rejected by
   zod `.datetime()`. Queue generation 500'd for every workspace with a live connector.
6. Evidence pairing joined on chunk fields that do not exist, fell back to positional
   pairing, and attached excerpts to the wrong source.
7. Ranking signals were negation-blind. A ticket reading "No customer impact" scored +9 for
   customer consequence and ranked #2. Caught only because the receipt explains itself in
   score component deltas.

## 7. Single live latency observation

One end-to-end measurement taken against production on 2026-08-02, recorded because it is
real. It is a single observation, not a distribution: no p50 or p95 is claimed, and one
sample must not be quoted as either.

| Field | Value |
| --- | --- |
| Question | "Who reported the AuthShield outage, which project is it on, and what did engineering commit to?" |
| Routed mode | `thinking` |
| Routed category | `cross_source_fact` |
| End-to-end latency | 5164 ms |
| Evidence returned | 7 sources |
| Providers represented | linear |

Two things this does and does not show. It does show the exact-ID routing fix working on a
live multi-part question: the question carries no bare identifier lane and correctly
escalates to `thinking` rather than a single-pass lookup. It does not show answer quality,
because no inference provider is configured; the returned answer is a template that lists
the cited evidence rather than synthesised prose, and the product does not present it as
anything else.

A latency distribution requires repeated runs across the 39 evaluation cases against live
connectors. That has not been done.
