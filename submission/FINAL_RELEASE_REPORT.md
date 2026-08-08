# QueueProof final release report

> This report is completed from live receipts at release time. No SHA, deployment, connector,
> benchmark, MCP, or video claim may be copied from an older release.
>
> **Status: RECEIPTS COMPLETE.** Every number below was measured against production
> `b930c816071b86ad9ac1cc846fc24a452d3aa4a7` between 2026-08-08T02:59Z and 2026-08-08T03:19Z. Where
> a result is unfavourable it is stated as measured; where a capability is unproven it is marked NOT
> TESTED rather than claimed.

## Production release

| Field | Generated-at-release value | Authoritative source |
| --- | --- | --- |
| Live URL | <https://queueproof.vercel.app> | Canonical deployment |
| Benchmarks URL | <https://queueproof.vercel.app/benchmarks> | Canonical deployment |
| GitHub URL | <https://github.com/vaibhav4046/queueproof> | GitHub; visibility currently owner-controlled |
| Starting branch | `codex/dialog-autofocus` | GitHub ref |
| Product release SHA | `b930c816071b86ad9ac1cc846fc24a452d3aa4a7` | GitHub |
| Health endpoint SHA/ref | `b930c816071b86ad9ac1cc846fc24a452d3aa4a7` / `main` | `/api/health/live` |
| Vercel deployment ID | `dpl_4iNZZDvwGfEeNMm7uoKws3CjZX7Y` | `/api/health/live` / Vercel receipt |
| Deployment URL | `queueproof-1n98tdpnq-vaibhav4046s-projects.vercel.app` | `/api/health/live` |
| Deployment timestamp | `2026-08-08T02:59:22.159Z` | `/api/health/live` |
| Benchmark receipt version | `grounded-grader-v3` | `/api/health/live` |

Release identity gate: **PASS** — read from `/api/health/live` at 2026-08-08T03:11:48.385Z:
`status live`, `service queueproof-web`, `environment production`, `target production`, with the
SHA, ref, deployment ID, and timestamp above. Every measured number in this report was produced
against that exact deployment.

Documentation-only commits land after `b930c81` (this report, the submission copy, the regenerated
`evals/results/*` artifacts, and `BENCHMARK_REPORT.md`). Vercel redeploys on each push, so
`/api/health/live` may report a later SHA than `b930c81` by the time a judge reads it. That later
SHA serves an identical product surface, and the claim is verifiable rather than asserted:

```bash
git diff --stat b930c816071b86ad9ac1cc846fc24a452d3aa4a7..origin/main
```

No path outside `submission/`, `evals/results/`, and `BENCHMARK_REPORT.md` may appear in that diff.
If one does, this report is stale and its numbers must be regenerated before submission.

## Material changes

Each bullet was re-checked against the source at `b930c81` rather than carried forward on trust; the
file reference is the check.

- Evidence retrieval validates connector/resource lineage on returned HydraDB rows and refuses to
  treat a row whose returned `connector_id` does not match the requested connector as attested
  proof (`lib/server/hydradb-shapes.ts:158-200`).
- Grounded synthesis supports `abstained` and `partial` outcomes, emits explicit
  `missingInformation`, and preserves contradictions instead of resolving them
  (`lib/server/synthesis.ts:977`, `:1242-1256`).
- The Today queue writes deterministic, policy-versioned ranking packets: the same input hash and
  policy version must always yield the same score (`lib/server/queue.ts:1237`, `:1354-1359`), and a
  persisted queue item shares the query's exact evidence lineage
  (`lib/server/grounded-action.ts:37`).
- Public reads remain open; connector configure/discover/sync/verify, document upload, database and
  HydraDB configuration, and action approval are all owner-gated server-side
  (`lib/server/store.ts:475`, enforced across `app/api/connectors/*`, `app/api/documents/*`,
  `app/api/databases`, `app/api/hydradb/configure`, `app/api/actions`).
- Release health and benchmark acceptance bind results to an exact production SHA/ref
  (`/api/health/live` and the `/api/lab` binding asserted by `scripts/release-gate.mjs`).
- Browser-facing evidence dates are normalized before formatting: SQLite `CURRENT_TIMESTAMP` values
  omit their UTC designator, so they are rewritten to explicit `Z` and rendered in UTC to stop the
  SSR label drifting during hydration (`app/date-label.ts`).

## Verification

| Gate | Final receipt |
| --- | --- |
| Node / pnpm | Node `v24.12.0`, pnpm `10.33.0` |
| Typecheck | **PASS** — `pnpm typecheck` exit 0, no diagnostics |
| ESLint | **PASS** — `pnpm lint` exit 0, no errors or warnings |
| Full tests | **PASS** — `pnpm test`: `Test Files 74 passed (74)`, `Tests 654 passed (654)` |
| Router benchmark | **PASS** — `pnpm benchmark:router`: "PASS  all 353 fixture assertions." |
| Build | **PASS** — `pnpm build` exit 0. Locally the pulled `.env.production.local` Vercel dump must be moved aside first; the same commit builds clean on Vercel, which is the authoritative build |
| Deploy binding check | **PASS** — `pnpm deploy:check` exit 0 |
| Release route gate | **PASS** — `pnpm release:verify` exit 0: production `b930c816071b86ad9ac1cc846fc24a452d3aa4a7` (`dpl_4iNZZDvwGfEeNMm7uoKws3CjZX7Y`) serves the `ember-assistant-v1` marker, binds `/api/lab` to the same release, serves the full public route/icon surface, enforces MCP OAuth, verifies the read-only public MCP demo, and returns the branded 404 |
| Security/MCP tests | **PASS** — `tests/mcp.test.ts` and the auth/authorization suites run inside the 654-test pass above; not a separate command |
| Secret scan | **PASS** — `pnpm scan:secrets`: `"blobsWithCandidates": 0` |
| Dependency audit | **3 high advisories, none on a runtime path** — `pnpm audit --audit-level moderate` exits 1 on `image-size` (<=2.0.2, via `.>vinext>image-size`, 2 paths) and `nanoid` (<3.3.17, GHSA-2v37-7h3g-55p8, via `.>@tailwindcss/postcss>postcss>nanoid`). Both are transitive build/dev dependencies that do not ship in the served bundle. Reported, not suppressed |
| Desktop browser | **PASS** — 1280x800 load of <https://queueproof.vercel.app>: title "QueueProof — Ask your work. Get the proof.", "4 verified sources" rendered, **zero console errors**, every network request `200` (including `/api/lab`, `/api/connectors`, `/api/queue`) |
| Mobile browser | **PASS** — 375x812 reload: `{"vw":375,"scrollW":375,"clientW":375,"overflow":false}` (no horizontal overflow), **zero console errors** |

Every row above is current command or browser output from this release pass, not a frozen earlier
total. The dependency-audit row is a real non-zero exit and is stated as such.

## Connector and document receipts

Read live from `/api/connectors` and `/api/documents` at 2026-08-08T03:11Z.

| Provider/document | State | Attributable records / source ID | Verified at | Counted? |
| --- | --- | --- | --- | --- |
| Helios Slack (`slack`) | `data_verified` | 3 canary results · `public-connector-e4f2f8bc3c11d71f838fcd29b5b0b68a` | `2026-08-02T17:25:25.069Z` | YES |
| Helios GitHub (`github`) | `data_verified` | 1 canary result · `public-connector-bf4d491de6843c437f350a42ac9a90bf` (last successful sync `2026-08-02T17:39:44Z`) | `2026-08-02T17:40:26.794Z` | YES |
| Helios Linear (live) (`linear`) | `data_verified` | 5 canary results · `public-connector-35e6de7e7be7c9a42ff72881f680f84f` | `2026-08-02T01:04:33.752Z` | YES |
| Helios Gmail (`gmail`) | `data_verified` | 4 canary results · `public-connector-f19a1b7bbaa1e6d8105e356e28b84d2d` | `2026-08-02T19:15:40.723Z` | YES |
| Helios Linear (second instance) | `degraded` / `canary_failed` | 0 canary results · `public-connector-f19e79ef8334babace9d8939becf582e` | never (`verifiedAt: null`) | **NO** |
| 346-page document | `indexed`, `sourceReceiptPresent: true` | `helios-operations-handbook.pdf` · 958,096 bytes · 346 pages · QueueProof doc `public-ref-0a95f4761a5d2851606ece43f0cc710b` · HydraDB source `f64d374d1899f3057707528f77703f3f` · SHA-256 `c047a3d09c45ecf97e3ed8e2115eda08ea0f6152206237955030f4304fa2ed93` | indexed `2026-08-03T08:31:03.028Z` (processing 5,716,028 ms) | YES |

**Four** connectors count against the three-connector requirement. The fifth Linear connector is
reported as failing and is deliberately excluded from the denominator rather than hidden: a
`degraded` connector with zero canary results and no `verifiedAt` has no attribution proof, so it
cannot count.

## Production benchmark

Release SHA: `b930c816071b86ad9ac1cc846fc24a452d3aa4a7` — every artifact below carries
`releaseVerified: true` and `commitRef main`. Grader `grounded-grader-v3`. Connector fixture
`live-cases-v2` (8 cases); PDF fixture `evals/fixtures/large-pdf-facts.json` (22 cases).

| Run | Passed/cases | Required facts | Claim support | Citation resolution | Unsupported claims | p50/p95 | Calls | Units |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Auto | 7/8 | 25/25 | precision 1.0 | completeness 1.0 | 0 (rate 0) | 1890 / 2795 ms | 10 | 10 |
| Fast | 7/8 | 25/25 | precision 1.0 | completeness 1.0 | 0 (rate 0) | 1796 / 2347 ms | 10 | 10 |
| Thinking | 7/8 | 25/25 | precision 1.0 | completeness 1.0 | 0 (rate 0) | 9595 / 16710 ms | 18 | 34 |
| PDF core | 5/22 | 56/56 | precision 1.0 | completeness 1.0 | 0 (rate 0) | 1722 / 2165 ms | 29 | 29 |

Auto generated 2026-08-08T03:06:51.185Z, Fast 03:07:17.475Z, Thinking 03:08:52.281Z, PDF
03:12:41.732Z. Zero `fixture_invalid` cases in any run. Connector runs cover providers github,
linear, and slack. Cost model: `{"unit":"weighted HydraDB query","fastWeight":1,"thinkingWeight":3,"usd":null}`.

Mode comparison: **comparable, and Thinking lost.** On this frozen sample Thinking bought no
accuracy over Fast — identical 7/8 strict passes and identical 25/25 fact recall — while costing
5.3x the p50 latency (9595 ms vs 1796 ms) and 3.4x the weighted units (34 vs 10). Auto routed all
eight rows to the fast lane, which is the correct call and matches the Fast column exactly. This is
reported as measured rather than framed as a Thinking win.

Failed cases/timeouts:

- **Connector runs (all three modes), one non-pass row:** `REVIEW post-mortem attribution
  cross-check` — 3/3 facts, providers github + slack, 1955 ms in auto, mode `fast`. Root cause is
  precise and not a retrieval failure: `providerPass`, `citationPass`, and `contradictionPass` are
  all true, `citationPrecision` and `citationCompleteness` are both 1.0, `unsupportedClaims` is
  empty, and `integrityStatus` is `ok`. It fails only on `relevancePass: false`
  (`relevancePrecision 0.6667`) because one of three claims — "I have committed to Northwind that we
  will ship the AuthShield fix before Friday 7 August 2026." (citation
  `public-citation-9e114dd2213b662726f8f123e5ab2fb7`) — is grounded and correctly cited but does not
  answer the question asked. Strict grading counts that as a failure. It is not softened here.
- **PDF core, 17 non-pass rows of 22.** All 17 are `REVIEW`, not timeouts: every row returned HTTP
  200, `apiOk` true, `exactIdPass` true, and `documentReceipt` true, with full required-fact recall
  (56/56 overall) and citation precision 1.0. The 17 fail strict relevance only:
  `relevancePrecision 0.625`, `irrelevantClaimRate 0.375`. Verified cause, read from the source
  rather than guessed — `lib/server/synthesis.ts` deliberately splits table rows into independent
  claim units because table rows carry no sentence punctuation, so answers drawn from the handbook's
  ASCII tables emit fragments such as `"| \| DRILL-2031-04 | \| 11 April 2031 | ...
  +------------------+---------- | \| retry"` as separate claims. Those fragments carry no
  configured expected-fact signal, so strict relevance marks them irrelevant. Retuning the
  synthesis splitter was considered and **deliberately declined** at this point in the release: it
  would risk a currently-green production release to improve a grading artifact, not correctness.
  The five strict passes are `fact-superseded-policy` (p7), `fact-atlas-deadline` (p81),
  `fact-eng-456` (p82), `fact-distractor-draft` (p290), and `fact-end-battery` (p340).
- No timeouts occurred in any run.

Contradiction and cross-source outcomes: the connector runs surfaced a contradiction on three of the
four flagship workflows, each preserved and each with 0 supported contradictions — the disagreement
is shown rather than silently resolved. PDF canaries resolved
`{"beginning":false,"middle":false,"end":true}`: the end-of-document canary (p340) passes strictly,
while the beginning and middle canaries land in the same table-fragment `REVIEW` class described
above with their required facts recovered. The document-plus-connectors cross-source extension row
is `pass: false` while matching **both** required facts (`issue` = ENG-456 and
`english-requirement`) — again a strict-relevance outcome, not a recall miss, and reported
separately from PDF core.

All units are relative query work, not dollars. The sample is small and frozen; it is a release
diagnostic, not an SLA.

## Production workflow receipts

For each flagship workflow, record question, direct answer, providers, claims, citations,
contradictions, missing proof, receipt ID, and strict result:

All five below are strict passes (`pass: true`) from the auto run at
`b930c816071b86ad9ac1cc846fc24a452d3aa4a7`.

1. **AuthShield incident** — "Who escalated the AuthShield outage, what did engineering commit to,
   and is the fix already merged?" Providers github + linear + slack. 4 claims, 4 supported, 4 cited
   sources, 1 contradiction preserved (0 supported), 3/3 required facts, 0 missing facts. Receipt
   `public-query-453b58450ac1ead3dc4ed103939f874e`, 1760 ms, 1 HydraDB call. **PASS**
2. **Most-recent shipment** — "What is the most recent thing we shipped?" Provider github. 1 claim,
   1 supported, 1 cited source, 1 contradiction preserved (0 supported), 3/3 facts. Receipt
   `public-query-c002dd95fb2651abd659abe676cf8cf5`, 2795 ms, 2 calls. **PASS**
3. **Exact identifier plus context** — "What is BUG-123, who filed it, and which project is it
   against?" Providers linear + slack. 2 claims, 2 supported, 3 cited sources, 1 contradiction
   preserved (0 supported), 4/4 facts. Receipt
   `public-query-42b791564512c21041a4666c71069997`, 1911 ms, 2 calls. **PASS**
4. **Cross-source commitment confirmation** — "Do Slack and Linear both independently confirm the
   AuthShield fix commitment date for Northwind?" Providers github + linear + slack. 3 claims, 3
   supported, 3 cited sources, 3/3 facts. Receipt
   `public-query-a5cbb3da15f3a1a36fa1dcdc659bc575`, 1998 ms, 1 call. **PASS**
5. **Large document** — PDF case `fact-eng-456` (page 82): "What work does ENG-456 track and when is
   it due?" 4/4 facts, 2 claims, 2 citations, `documentReceipt: true`. Receipt
   `public-query-4d64960d5f9f123286e25567d1938ee5`, 1796 ms, 2 calls. **PASS**

Receipt IDs and metadata only; no private record bodies are pasted into this public report.

## Remote MCP

| Field | Final receipt |
| --- | --- |
| Canonical URL | `https://queueproof.vercel.app/mcp` |
| Protocol/transport | `2025-06-18` negotiated over streamable HTTP (SSE responses) |
| Authentication | Bearer on `/mcp` (anonymous POST → `401` + RFC 9728 `WWW-Authenticate` resource metadata); `/mcp/demo` is a deliberately public read-only reviewer surface |
| OAuth metadata | Live issuer `https://queueproof.vercel.app`: `/.well-known/oauth-protected-resource` and `/.well-known/oauth-authorization-server` publish authorize/token/register endpoints and scopes `queueproof:read/propose/sync` |
| Anonymous `/mcp` receipt | Verified 2026-08-08T03:18Z at SHA `b930c81`: anonymous `POST /mcp` → `401` with `www-authenticate: Bearer resource_metadata="https://queueproof.vercel.app/.well-known/oauth-protected-resource/mcp", scope="openid profile email", error="invalid_token", error_description="Connect this client to QueueProof to continue."` |
| Discovered tools/resources | `initialize` on `/mcp/demo` negotiated protocol `2025-06-18`; `serverInfo` = `queueproof 0.2.0` ("QueueProof — Evidence and Priority Control Plane"). `tools/list` → `queueproof_search` |
| Read-only call (public demo surface) | `tools/call queueproof_search` on `/mcp/demo` at SHA `b930c81`, 2026-08-08T03:18:28.661Z, AuthShield question → `validation.status "grounded"`, `providerCoverage ["linear","github","slack"]`, 4 claims / 4 cited claims / 4 citations / 4 evidence items, 1 contradiction preserved, `missingInformation []`, `partial false`, `failedScopeCount 0`, `mode "thinking"`, `latencyMs 4209` (5008 ms wall including transport), `callCount 1`, `estimatedCostUnits 3`. Evidence spans linear + github + slack + slack. The self-referential filter held: no QueueProof PR or CI chatter leaked into the reviewer surface |
| Authenticated read-only call | PENDING — requires the owner's scoped bearer token; no authenticated client claimed |
| Claude Code | NOT TESTED against production in this release pass; no client named |
| Codex | NOT TESTED against production in this release pass; no client named |
| Claude web | NOT CLAIMED — OAuth end-to-end consent not exercised |

Anonymous 401 alone is not an authenticated MCP receipt; the grounded `tools/call` receipt above
is from the public demo surface, not a bearer session.

## Judge panel

Complete the evidence-backed scores in [OFFICIAL_RUBRIC.md](OFFICIAL_RUBRIC.md). Keep every
deduction and mark a category release-blocking when its official requirement is unproven.

## Submission

- Ready-to-paste copy: [HACKATHON_SUBMISSION.md](HACKATHON_SUBMISSION.md)
- Primary two-to-three-minute script: [VIDEO_SCRIPT_2_3_MINUTES.md](VIDEO_SCRIPT_2_3_MINUTES.md)
- Supademo shot and voice plan: [VIDEO_VOICE_SEGMENTS.md](VIDEO_VOICE_SEGMENTS.md)
- 60-second script: [VIDEO_SCRIPT_60_SECONDS.md](VIDEO_SCRIPT_60_SECONDS.md)
- Four-minute script: [VIDEO_SCRIPT_4_MINUTES.md](VIDEO_SCRIPT_4_MINUTES.md)
- Demo runbook: [DEMO_RUNBOOK.md](DEMO_RUNBOOK.md)
- Judge Q&A: [JUDGE_QA.md](JUDGE_QA.md)

## Remaining manual actions

Every engineering gate that can be completed without owner credentials is complete. What remains
requires an account, a credential, or a decision only the repository owner can make.

- `[x]` Measure every gate, connector, benchmark, workflow, and MCP receipt at
  `b930c816071b86ad9ac1cc846fc24a452d3aa4a7` and record them above.
- `[x]` Record the video — final 59.5 s cut at `video/queueproof-demo-v2.mp4` (icon scene,
  aligned captions, −15.0 LUFS / −1.3 dBTP, transcript verified against the locked script).
- `[ ]` **Rotate the access token that was exposed outside the approved secret store.** Do this at
  the provider, not in this repository; the value is deliberately not reproduced anywhere in this
  package. Treat it as compromised until rotated.
- `[ ]` Make the repository public — owner approval only; verify signed-out access afterwards.
- `[ ]` Upload `video/queueproof-demo-v2.mp4` and verify its public URL.
- `[ ]` Paste the final repository and video URLs into the hackathon form and submit.
- `[ ]` Optional, not required by any claim in this report: supply the dedicated
  benchmark-publishing token to publish the current-SHA artifacts through `/api/lab`. Do not
  substitute a Vercel or MCP token. The artifacts in `evals/results/` already carry
  `releaseVerified: true`, so nothing above depends on this step.
- `[ ]` Optional: complete client OAuth consent. Deliberately unclaimed — see the Remote MCP table,
  where Claude Code, Codex, and Claude web are all recorded as NOT TESTED rather than asserted.

Status: **DONE for every controllable gate.** This report contains no placeholder promoted as
fact — the two unfavourable results (one strict `REVIEW` on the connector fixture, 17 strict
`REVIEW` rows on the PDF fixture) are stated with their measured cause rather than softened, and the
dependency audit's non-zero exit is recorded rather than suppressed.
