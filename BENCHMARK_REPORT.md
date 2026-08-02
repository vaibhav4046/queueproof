# QueueProof benchmark report

Measured values only. Every number below was produced by a runner or observed on live
production. Nothing is estimated, interpolated, rounded in the product's favour, or carried
over from a previous run. Metrics that were not measured are listed as not measured, with
the reason.

> **Maintenance note.** Section 1 reproduces the output of `node scripts/run-evals.mjs`,
> which regenerates this file and will overwrite everything below section 1 when it runs.
> Sections 2 to 7 are hand-recorded live observations that the runner cannot produce,
> because the live phase reports `NOT_REQUESTED` without credentials. Re-apply them after
> any regeneration, or move them to a file the runner does not own.

Evaluation runner: `node scripts/run-evals.mjs`, last run 2026-08-02T17:42:25.585Z
Fixtures: `evals/fixtures/cases.json` (39 ground-truth cases, fictional company "Helios
Robotics")
Runner artefacts: `evals/results/results.json`, `evals/results/results.csv`

---

## 1. Evaluation suite: router mode accuracy

**29 / 39 = 74.4 per cent.** Unchanged across reruns.

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

### Ranking cases

Three cases declare an expected top task. Each builds real `RankingInput` objects, validates
them against `rankingInputSchema`, and calls the real `rank()`.

- `prio-01`: expected `task-atlas-blocker`, got `task-atlas-blocker`. PASS
  (order: task-atlas-blocker=82, task-vega-polish=23)
- `prio-02`: expected `task-bug123-fix`, got `task-bug123-fix`. PASS
  (order: task-bug123-fix=73, task-nimbus-oncall=46, task-doc-refresh=13)
- `prio-03`: expected `task-northwind-sla`, got `task-northwind-sla`. PASS
  (order: task-northwind-sla=72, task-kestrel-contract=38, task-internal-tooling=24,
  task-vega-shipped=0)

### Fixture assertions

All 325 fixture-computable assertions passed.

### Fixture-mode provider availability

Fixture mode proves nothing about connectors. Unless `QUEUEPROOF_AVAILABLE_PROVIDERS` is set
explicitly the available set is empty and every case counts as unserviceable. These counts
describe the fixture set, not production, where Linear and Slack are verified.

| Measure | Value |
| --- | ---: |
| Available providers | none |
| Cases with at least one unavailable provider | 39 of 39 |
| Cases blocked on `document` | 9 |
| Cases blocked on `gmail` | 11 |
| Cases blocked on `linear` | 24 |
| Cases blocked on `slack` | 16 |

### Runner live phase

`NOT_REQUESTED`. The runner's live phase runs only with `--live` and all four of
`QUEUEPROOF_LIVE_TEST`, `QUEUEPROOF_URL`, `QUEUEPROOF_SESSION_COOKIE` and
`QUEUEPROOF_DATABASE`. Without them it skips loudly and exits non-zero rather than reporting
a number it did not measure. The live observations in section 2 were recorded by hand
against production, not produced by this runner.

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
| Linear connector, driven entirely through the product | stage `data_verified`, `configured=1`, discovery returned real team "Helios Robotics" (resource type `linear_team`), `realObjectsRetrieved` = 5, five real source ids persisted in a verification record |
| Slack connector, driven entirely through the product | stage `data_verified`, `realObjectsRetrieved` = 3, verification id `verify_87da58b8-9f1f-48d6-9c98-5f118ba9b93e`, resource `C0B462AK7U3` (#all-qyntra), workspace `qyntra` |
| `providerCoverage` | `["linear"]` on the first cross-source run, both providers once Slack was verified |
| Cross-source retrieval, documents plus Linear | 10 sources: 6 ingested documents and 4 Linear tickets (HEL-4, HEL-5, HEL-6, HEL-7) |
| Cross-source retrieval, two providers | 11 sources spanning linear and slack. Mode `thinking`. 4220 ms end to end |
| Contradiction reported rather than averaged | linear: "Billing migration deadline moved to 14 August" against slack: "the Linear ticket still says 14 August, but finance confirmed today it is staying at 7 August. Linear is out of date." |
| Queue generation from live evidence | HTTP 200, 3 ranked items spanning both providers, with real citations, receipt hashes and why-above-#2 explanations computed from score component deltas |

### Final ranking produced from live evidence, both providers

| Rank | Score | Provider | Item |
| ---: | ---: | --- | --- |
| 1 | 77 | linear | AuthShield authentication outage for Northwind |
| 2 | 67 | slack | Commitment to ship the AuthShield fix before 7 August |
| 3 | 58 | slack | Promised post-mortem with no Linear issue tracking it |

Rank 3 is an untracked commitment found in real evidence: a promise made in Slack with no
ticket behind it.

An earlier run, before Slack was verified, produced a Linear-only queue: AuthShield
authentication outage for Northwind (77), billing migration deadline (47), Rover SDK docs
refresh (35). Both runs are recorded; the two-provider queue above is the current one.

### Connector proof under a real failure

Slack discovery succeeded while sync returned nothing, because Slack does not return
`conversations.history` until the bot is invited to the channel. That is Slack behaving
correctly, not a connector defect. QueueProof refused to report `data_verified` throughout,
consistent with its behaviour for Linear, and the stage moved only once real objects came
back.

---

## 3. Deterministic artefact

The 346-page ground-truth PDF is byte-identical across runs.

| Measure | Value |
| --- | --- |
| Pages | 346 |
| Size | 958,096 bytes |
| SHA-256 | `c047a3d09c45ecf97e3ed8e2115eda08ea0f6152206237955030f4304fa2ed93` |
| Determinism | Identical hash across runs |
| Planted ground-truth facts | 22 |

**This PDF has not been ingested into HydraDB.** It is a deterministic artefact, not an
indexed source, and no retrieval metric here is derived from it.

---

## 4. Engineering gates

| Gate | Result |
| --- | --- |
| Tests | 208 passing |
| Typecheck | clean |
| Lint | clean |
| Production build | clean |

Passing tests are not offered as evidence of live behaviour. The live claims in section 2
stand on their own runs.

---

## 5. Not measured

Absent by design. No value is guessed for any of these, and none may be quoted in the
submission.

| Metric | Status | Why not |
| --- | --- | --- |
| Citation precision | not measured | Requires a human-labelled citation key over the indexed corpus. None exists. |
| Citation recall | not measured | Requires the full set of correct sources per question. Not labelled. |
| End-to-end latency, including percentiles | not measured | One query was timed at 4220 ms. That is a single measurement, not a distribution, and no series was collected. Do not quote a percentile. |
| HydraDB call count per query | not measured | Not instrumented and not counted during the live runs. |
| Cost per query | not measured | Derived from provider and HydraDB usage, which was not metered. |
| Conflict-detection accuracy | not measured | One contradiction was observed and reported correctly. No labelled conflict set exists, so there is no rate. |
| Untracked-commitment recall | not measured | One untracked commitment was surfaced. No ground-truth set of untracked commitments exists. |
| Retrieval quality over the 346-page PDF | not measured | The PDF was never ingested, so no retrieval ran against it. |
| Gmail connector behaviour | not measured | Not connected. Google requires a passkey challenge to reach the App Passwords page, which needs a physical biometric or hardware gesture. Blocked by the authentication mechanism, not by preference. |
| Real Linear write execution | not measured | The approval-gated path is unit-tested against an injected fetch only. No real issue has been created. |
| MCP receipt-hash parity against an external client | not measured | The hash is computed and persisted, but no external MCP client has fetched the same receipt. |

---

## 6. Routing defect found by the evaluation suite

On its first real run the suite exposed a routing defect in QueueProof's own retrieval
router. `planRetrieval` short-circuited on any exact identifier and returned `mode: "fast"`
before evaluating any multi-step signal, so the flagship demo question ("Who filed BUG-123,
which project are they working on, and what did they say about the fix in Slack?") was routed
to a single-pass lookup and could never have been answered. Reasoning signals are now
computed before the identifier lane is chosen; the lane still runs text and hybrid retrieval
in parallel but escalates to `thinking` when the question needs multi-step reasoning.

Fix in commit `360c176`, pinned by `tests/router-flagship.test.ts` (2 tests, both passing).

**Aggregate accuracy did not improve.** It stayed at 29/39 = 74.4 per cent. Under-escalations
fell from 8 to 7 and over-escalations rose from 2 to 3. This is recorded as measured, not
presented as a score improvement.

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
