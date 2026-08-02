# QueueProof requirements matrix

Status labels are deliberately narrow.

- **verified-live**: run against live production at <https://queueproof.vercel.app> and the
  result observed.
- **measured**: a number was produced by a runner and recorded as produced, not rounded or
  estimated.
- **built-untested-live**: the code exists and passes the test suite, but the path has never
  been exercised against the real external service. Not a working feature.
- **blocked-on-credentials**: cannot be proven without the owner's own provider logins. No
  fixture is substituted.
- **not-implemented**: does not exist.

Nothing below is marked complete on the strength of a passing test alone.

## Evidence layer and HydraDB

| Criterion | What exists | Evidence | Status | Limitation |
|---|---|---|---|---|
| HydraDB configured through the product | Credential entered through the product UI, encrypted at rest, surfaced only as a fingerprint | Fingerprint `503f442f560614fc` | verified-live | Single workspace credential exercised |
| Live provider catalogue | Providers and their credential schemas loaded from HydraDB at runtime, not hardcoded | 61 real providers loaded live with real credential schemas | verified-live | Three providers were taken through to verified connectors |
| Document ingestion | Upload through the product, HydraDB `/context/ingest`, poll `graph_creation` to `completed`, stage `indexed` | Source id `5fa3cc1258f4d1380685120889e2e8f3` | verified-live | Ingestion volume not stress-tested |
| Connector proof protocol | create, discover, configure, sync, verify, reaching `data_verified` only after a canary query returns provider-attributable objects | Linear, Slack, and GitHub are all `data_verified`; the latest live benchmark returned provider-attributable evidence from all three on 6/6 questions | verified-live | Gmail is configured and authenticated, but its free-plan backfill has not produced cursor evidence yet |
| Cross-source retrieval, documents plus one provider | One query spanning ingested documents and live connector objects | 10 sources returned: 6 ingested documents and 4 Linear tickets (HEL-4, 5, 6, 7) | verified-live | |
| Cross-source retrieval, two providers | One query spanning two independently verified connectors | Question "Who escalated the AuthShield outage, what deadline did engineering commit to, and does Linear agree?" returned 11 sources spanning linear and slack, mode `thinking`, 4220 ms | verified-live | One timed query. Not a latency distribution |
| Cross-source retrieval, three providers | Six production questions spanning GitHub, Linear, and Slack | All 6/6 returned evidence from all three providers; 4 thinking and 2 fast routes | verified-live | Small six-query sample |
| Contradiction surfaced rather than averaged | Conflicting evidence is reported as a conflict | linear: "Billing migration deadline moved to 14 August" against slack: "the Linear ticket still says 14 August, but finance confirmed today it is staying at 7 August. Linear is out of date." | verified-live | Observed on one query; no conflict-detection accuracy metric exists |
| Slack connector | Driven entirely through the product: create, discover, configure, sync, verify | Stage `data_verified`, `realObjectsRetrieved` = 3, verification id `verify_87da58b8-9f1f-48d6-9c98-5f118ba9b93e`, resource `C0B462AK7U3` (#all-qyntra), workspace `qyntra` | verified-live | One channel |
| Slack proof protocol held under real failure | Stage must not advance on a credential alone | Discovery succeeded while sync returned nothing, because Slack does not return `conversations.history` until the bot is invited to the channel. Slack behaving correctly, not a connector defect. The product refused to report `data_verified` throughout, consistent with its behaviour for Linear | verified-live | |
| GitHub connector | Full proof lifecycle through HydraDB | Evidence present in all six three-provider live benchmark questions | verified-live | One connected account scope |
| Gmail connector | Authenticated, eight real labels discovered, and configured in HydraDB | Connector `3c628abf-b14d-4cfa-bbc7-27a03fa6b2ac`; backfill reports `active` on the free plan | built-untested-live | No provider cursor yet, so QueueProof correctly refuses `data_verified` |

## Priority Compiler and Decision Receipts

| Criterion | What exists | Evidence | Status | Limitation |
|---|---|---|---|---|
| Queue generation from live evidence | Ranking over evidence retrieved from HydraDB | HTTP 200, three ranked items spanning both connected providers | verified-live | Three items; not tested at queue scale |
| Untracked commitment detection (the Action Gap) | Work promised in conversation with no ticket behind it is surfaced and ranked | Rank 3, score 58, slack: a promised post-mortem with no Linear issue tracking it. Found in real evidence, not a fixture | verified-live | One instance observed; no recall metric for untracked commitments exists |
| Real citations on ranked items | Each item carries evidence with real Linear source citations | Citations present on all three items | verified-live | Citation precision and recall are not measured |
| Receipt hash | Hash computed and persisted with the packet | Present on generated items | verified-live | Parity against an external MCP client is unproven |
| Why-above-number-two explanation | Computed from score component deltas, not narrated after the fact | Present on generated items | verified-live | |
| Deterministic ranking | Score is a function over explicit components | Final ranking across both providers: AuthShield authentication outage for Northwind, linear (77); commitment to ship the AuthShield fix before 7 August, slack (67); promised post-mortem with no Linear issue tracking it, slack (58) | verified-live | Calibration against a large corpus not done |
| Negation handling in ranking signals | Fixed after the receipt exposed it | A ticket reading "No customer impact" scored +9 for customer consequence and ranked #2. Caught from the component deltas in the receipt | verified-live | Found by inspection of the receipt, not by an automated test |

## Security

| Criterion | What exists | Evidence | Status | Limitation |
|---|---|---|---|---|
| Session authentication | HMAC-signed httpOnly session cookie | Nine attack variants return 401: spoofed identity header, Host-prefix bypass, no credentials, wrong token, garbage signature, payload swap with the signature kept, unsigned payload, expired but correctly signed, unauthenticated route access. Valid session returns 200 | verified-live | Run against live production; identity is never taken from a caller-controlled header |
| Credential encryption at rest | Provider credential encrypted, browser sees only a fingerprint | Fingerprint `503f442f560614fc` | verified-live | |
| Durable storage | Turso/libSQL, EU West | `/api/health/ready` returns 200 ready | verified-live | |
| Approval gate on writes | Web and MCP propose an exact payload; the Approvals UI exposes payload, evidence and risk, requires a second confirmation, and claims a unique execution slot before the Linear call | 13 action tests, production build, and the web control plane | built-untested-live | No real Linear issue has been created through it; the deployment needs `LINEAR_API_KEY` for execution |

## Agent surface

| Criterion | What exists | Evidence | Status | Limitation |
|---|---|---|---|---|
| MCP endpoint | Authenticated, workspace-bound | Covered by the test suite | built-untested-live | Not exercised against an external MCP client in this pass |
| Receipt-hash parity across clients | Hash computed and persisted once | No external MCP client has fetched the same receipt | built-untested-live | Do not claim parity. Not complete |

## Evaluation

| Criterion | What exists | Evidence | Status | Limitation |
|---|---|---|---|---|
| Ground-truth evaluation suite | 39 cases across 15 categories | Runner output recorded in `BENCHMARK_REPORT.md` | measured | |
| Router mode accuracy | Router decision compared against hand-written labels | 29/39 = 74.4 per cent | measured | Reported as measured, not improved to fit the pitch |
| Exact-identifier routing defect found and fixed | `planRetrieval` short-circuited on any exact identifier and returned `mode: "fast"` before evaluating multi-step signals, so the flagship demo question ("Who filed BUG-123, which project are they working on, and what did they say about the fix in Slack?") could never have been answered. Reasoning signals are now computed before the identifier lane is chosen; the lane still runs text and hybrid retrieval in parallel but escalates to `thinking` when the question needs multi-step reasoning | Commit `360c176`. `tests/router-flagship.test.ts`, 2 tests passing: the BUG-123 question asserts `mode === "thinking"`, `exactParallel === true`, `category === "exact_identifier"`; a bare "Show me BUG-123" asserts `mode === "fast"`, `exactParallel === true` | verified-live | **Aggregate accuracy did not improve.** It stayed at 29/39 = 74.4 per cent; under-escalations fell 8 to 7 and over-escalations rose 2 to 3. Not a score improvement and must not be presented as one |
| Citation precision | Not measured | No value produced | not-implemented | Requires a human-labelled citation key |
| Citation recall | Not measured | No value produced | not-implemented | Requires the full correct source set per question |
| Latency percentiles | Six-query live production run | p50 4401 ms, p95 6347 ms, min 990 ms, max 6347 ms | measured | A small sample, not a stable distribution or SLA |
| HydraDB call count | Not measured | No value produced | not-implemented | |
| Cost per query | Not measured | No value produced | not-implemented | |

## Artefacts and engineering hygiene

| Criterion | What exists | Evidence | Status | Limitation |
|---|---|---|---|---|
| Large ground-truth document | 346-page PDF, deterministic across runs | 958,096 bytes, SHA-256 `c047a3d09c45ecf97e3ed8e2115eda08ea0f6152206237955030f4304fa2ed93`, 22 planted ground-truth facts | verified-live (generation only) | **Not ingested into HydraDB.** It is an artefact, not an indexed source |
| Test suite | Unit and contract tests | 217 passing across 20 files | verified-live | Passing tests are not evidence of live behaviour; the live claims above stand on their own runs |
| Typecheck, lint, production build | All three clean | Clean | verified-live | |
| Repository | github.com/vaibhav4046/queueproof | Private | blocked-on-credentials | A judge cannot read it until access is granted or it is made public |

## Not implemented

| Criterion | Status | Note |
|---|---|---|
| Memory | not-implemented | |
| Skills runtime | not-implemented | |
| Decision replay | not-implemented | |
| Execution leases | not-implemented | |
| Change-ledger diffing | not-implemented | |

## The single honest gate

Linear, Slack, and GitHub are connected and verified through the product. Gmail is
authenticated, discovered, and configured but remains unverified while the free-plan
backfill advances. The real Linear write also remains outstanding. Both are marked
built-untested-live above and must not be described as complete anywhere in the submission.
Everything marked verified-live was run against <https://queueproof.vercel.app> and
observed.
