# QueueProof — continuity state

**Checkpoint written:** 2026-08-06 (session 3)
**Status:** ACTIVE — one user action gates everything that remains.
**Previous checkpoints:** session 2 (`1f90e66`), session 1 (`9821eee`).

`QUEUEPROOF_STATE.json` is the authoritative machine-readable status. Where this document and
that file disagree, the JSON is newer. Sections 1–3 (product definition, workflow, links) are
stable and were not rewritten; the per-task status narrative further down is **session-2 vintage**
and is superseded by the session-3 delta immediately below.

Every claim below was either re-verified by running the command shown, or is explicitly labelled
**CARRIED** (still believed true, not re-run) or **UNVERIFIED**. Do not promote a carried or
unverified line to a fact without re-running its check.

---

## 0. Session 3 delta — what changed and what still blocks

Session 3 landed the first product code since session 1. Three commits, all pushed to
`github/codex/dialog-autofocus`, none deployed:

| Commit | What it does | Evidence |
| --- | --- | --- |
| `c67352b` | Refuses a blocker answer grounded only in a shared entity token (defect **D1**) | 3 regression tests over an `atlasBlockerCorpus` fixture |
| `aa30fc8` | Makes native selects readable and the queue toolbar legible (**P5**) | contrast measured 1.07:1 → **16.31:1** |
| `358aac8` | `scripts/deploy-prod.mjs`, `deploy:prod` script, `.mcp.json` gitignored (**P4**) | `pnpm deploy:check` PASS |

**D1 root cause:** `tokenise()` stems `atlas` → `atla`, so an Atlas Copco recruiter advert scored
identically to the genuine Linear receipt. The fix adds an impediment gate in `relevance()` plus a
token-subset restatement check in `duplicatesPicked`.

**Full release gate, run this session, real output:**

| Command | Result |
| --- | --- |
| `pnpm typecheck` | clean, `TYPECHECK_OK` |
| `pnpm lint` | clean, `LINT_OK` |
| `pnpm test` | **46/46 files, 447/447 tests**, 15.49s |
| `pnpm benchmark:router` | `PASS all 353 fixture assertions`, router accuracy **42/42 = 100.0%**, 15/15 categories |
| `pnpm build` | `Build complete.` |
| `pnpm deploy:check` | `PASS Sites bindings declared` |

### The one thing blocking the rest

`pnpm deploy:prod` was **refused by the permission classifier** and was not routed around:

> Clearing requires the user to explicitly name deploying to production at queueproof.vercel.app —
> consider running this step outside auto mode so the permission prompt is reviewed directly.

Because of that, production still runs the pre-session artifact. `/api/health/live` still returns
`commitSha: null`, `/api/lab` still reports `caseCount: 39`, and **D1 still reproduces live even
though it is fixed in source**. P7 (deploy half), P8, P10 and P11 are all downstream of this single
action. Nothing else is waiting on anything.

### Second blocker (cosmetic)

The **P3** one-line eslint change is blocked by the ECC `config-protection` PreToolUse hook:

> BLOCKED: Modifying eslint.config.mjs is not allowed.

`pnpm lint` passes regardless — the script carries `--ignore-pattern dist`, and the 41 errors a
bare `eslint .` reports are all in generated `dist/` bundles, 0 in source. Unblock with
`ECC_HOOK_PROFILE=minimal` or `ECC_DISABLED_HOOKS=pre:config-protection`.

### Environment change made outside this repo

`D:\.claude\launch.json` (the user's global harness config) gained a `queueproof` entry on port
5199 so the preview tooling could start the dev server. Additive only; no existing entry changed.

---

## 1. Product definition

QueueProof is a daily **evidence workspace**. It answers one plain-language work question
across GitHub, Linear, Slack, Gmail and uploaded documents, and returns:

- one concise answer whose individual claims open to retained source receipts;
- the citations behind each claim (provider, timestamp, excerpt, receipt ID, original link);
- contradictions preserved rather than smoothed away;
- explicitly named missing evidence instead of a confident guess;
- an evidence-backed priority queue and a reviewable next-action brief.

HydraDB is the cross-source evidence layer. The same bounded **read** contract is exposed
over MCP so an AI client can use the product inside a daily workflow.

QueueProof is **not** a chatbot, not a search box, and not an autonomous agent. Writes are
proposals until a human approves them, and count as executed only after a provider response
ID is stored.

## 2. Primary user workflow

1. **Ask** — one question on `/` (Ask page).
2. **Proof** — open a numbered claim receipt, follow its original-source link.
3. **Sources** — inspect ready and degraded connector receipts with attributable records.
4. **Proof tests** (`/benchmarks`) — read same-release measured results, including `REVIEW` rows.
5. **Connect AI** (`/developer`, `/mcp`) — MCP endpoint, auth model, approval boundary.

## 3. Links

| What | Where |
| --- | --- |
| Repository | https://github.com/vaibhav4046/queueproof — **PRIVATE** (carried from session 1) |
| Production | https://queueproof.vercel.app (HTTP 200, verified 08:29Z) |
| Benchmarks | https://queueproof.vercel.app/benchmarks (HTTP 200, verified 08:29Z) |
| Release identity | https://queueproof.vercel.app/api/health/live |
| Current-release measurements | https://queueproof.vercel.app/api/lab |

Git remotes: `github` → GitHub; `sites` → a ChatGPT-sandbox mirror (`git.chatgpt-team.site`).
Push work to `github`. The `sites` remote is not project-controlled infrastructure.

## 4. Current branch, commit, worktree

```
cwd     D:\Codex d;\queueproof
branch  codex/dialog-autofocus
HEAD    9821eee4644135b5161bba35a46159f4a586e4fb  "docs: checkpoint QueueProof autonomous continuation"
remote  1 commit AHEAD of github/codex/dialog-autofocus (rev-list --left-right --count → 0 1)
        → the session-1 checkpoint commit has NOT been pushed
main    a884e8d — HEAD is 39 commits AHEAD of main
```

`9821eee` is documentation only (`git show --stat`): the four `docs/continuity/` files, 843
insertions, zero product files. So every code fact measured in session 1 still describes the
code at this HEAD.

**Worktree is NOT clean.** Uncommitted at checkpoint time, unchanged since session 1 and
deliberately left in place (this checkpoint commits continuity docs only):

- `M app/globals.css` — `.queue-toolbar` label font 7px→10px, select font 8px→12px, padding widened.
- `M app/product.css` — removed the forced light `select` colour block (`color: var(--paper)`,
  `background-color:#fff`, `color-scheme: light`, and the `select` / `select option` rules).
- `?? .mcp.json` — **untracked and still NOT gitignored** (`git check-ignore -v .mcp.json` → exit 1,
  no output). Contains a `perplexity-ask` server entry. Never commit it. Adding it to
  `.gitignore` is pending task P4.

These two CSS edits are an unfinished dropdown-legibility change. Decide deliberately: finish
and commit them, or `git checkout -- app/globals.css app/product.css`. Removing the light
`color-scheme` on `select` may regress dropdown contrast on dark backgrounds — verify in the
browser before committing.

## 5. Completed work

Verified in session 1, still true at this HEAD (no code changed since):

- 39 commits on `codex/dialog-autofocus` beyond `main`, most recently:
  - `9821eee` docs: checkpoint QueueProof autonomous continuation (docs only)
  - `993bd9e` stop duplicate and run-on claims in grounded answers (`lib/server/synthesis.ts` +59 test lines)
  - `0098552` stop uploading local build output to Vercel (`.vercelignore` now excludes `.next`, `.vinext`, `.wrangler`, `dist`, `out`, `coverage`, logs, secrets)
  - `27b6ab7` require a system-of-record delivery assertion, not a bare participle
  - `9469b5b` refuse to answer delivery questions from prose that only mentions the verb
  - `c70b8fe` expand frozen benchmark with recency routing and synthesis cases
  - `87a255e` render the queue on first paint and decouple its fetch
  - `f5fe0e1` answer most-recently questions with the newest evidence
  - `3a44895` open the workspace to every visitor and repair two real defects
- UI owner-token nags removed while server-side write protection was preserved
  (session 1: `grep -n "owner token\|ownerToken" app/QueueProofApp.tsx` → no matches).
- Platform-aware Ctrl/Command labels implemented (`app/QueueProofApp.tsx:230-236` — SSR renders
  "Ctrl", upgraded to `⌘` after mount; `Cmd/Ctrl+K` and `Cmd/Ctrl+Enter` handlers at lines 413 and 1192).
- Meaningful empty-body API errors implemented previously — **UNVERIFIED in either checkpoint.**
  Re-check `tests/api-hardening.test.ts` before claiming it.
- 48 test files under `tests/` (re-counted this session); 9 workspace packages under `packages/`
  (actions, connectors, contracts, graph, hydradb, mcp, ranking, retrieval, security).
- MCP read surface: `app/mcp/route.ts`, `app/api/mcp/route.ts`, `app/api/mcp-tokens/`,
  `app/.well-known/oauth-protected-resource/mcp/`, `packages/mcp/`, `cli/`.
- Submission copy drafted: `docs/SUBMISSION_COPY.md`, `docs/HACKATHON_FORM.md`,
  `docs/DEMO_SCRIPT_60S.md`, `docs/JUDGING_MATRIX.md`, `submission/*`.
- `docs/continuity/` package created (session 1) and rewritten (session 2).

## 6. Verified tests

**Not re-run in session 2.** No product or test file changed between the session-1 run and this
HEAD (`9821eee` is docs-only), so the result below is carried forward as still describing this
code. It is *not* a fresh measurement.

**CARRIED FROM SESSION 1** — run at 2026-08-06T02:26Z:

```bash
node ./node_modules/vitest/vitest.mjs run --config vitest.config.ts \
  tests/synthesis.test.ts tests/health-release.test.ts \
  --pool=threads --maxWorkers=1 --fileParallelism=false
```

```
Test Files  2 passed (2)
     Tests  41 passed (41)
  Duration  20.47s
```

The full suite (48 files) has **not** been run in either checkpoint. Its current pass count is
**UNVERIFIED**.

Lint — **CARRIED FROM SESSION 1**, and the config that produces it is confirmed unchanged this
session (`eslint.config.mjs` `globalIgnores` still lists only `.next/**`, `out/**`, `build/**`,
`next-env.d.ts`; no `dist` entry):

```bash
node ./node_modules/eslint/bin/eslint.js .
# ✖ 2643 problems (41 errors, 2602 warnings)
```

All 41 errors come from generated, gitignored build output — zero source files have errors:

| File | Errors |
| --- | --- |
| `dist/client/assets/index-DHsbXt1Q.js` | 3 |
| `dist/server/index.js` | 1 |
| `dist/server/ssr/assets/QueueProofApp-iDRJ8Yom.js` | 34 |
| `dist/server/ssr/assets/QueueProofLogo-Bq0Mel3B.js` | 1 |
| `dist/server/ssr/assets/red-plasma-Bca5jnzS.js` | 1 |
| `dist/server/ssr/index.js` | 1 |

`/dist/` is in `.gitignore` (line 43) and in `.vercelignore`; `package.json`'s `lint` script
already passes `--ignore-pattern dist --ignore-pattern .next`, so only the bare `eslint .`
invocation fails.

## 7. Verified benchmarks (local artifacts, historical release)

All three artifacts were produced against release
`aed027879150e3e324b54c5ec2194d4d715c501e` (ref `main`) — **not** the current HEAD. They are
provenance, not current-release measurements. Unchanged since session 1.

**Live** — `evals/results/live-run.json`, generated 2026-08-05T01:29:41Z, grader
`grounded-grader-v2`, `releaseVerified: true`:

- 6 cases, 4 passed; all 6 ran Fast, 0 Thinking (so no valid Fast-vs-Thinking comparison)
- latency p50 2155 ms, p95 2392 ms
- requiredFactAccuracy 1.0, requiredFactRecall 1.0, citationPrecision 1.0,
  citationCompleteness 1.0, unsupportedClaimRate 0
- providerRequirementPasses 4; contradictionRequirementPasses 1 of 2

**PDF** — `evals/results/pdf-live-run.json`, generated 2026-08-05T01:37:56Z, `releaseVerified: true`:

- document `helios-operations-handbook.pdf`, 346 pages,
  sha256 `c047a3d09c45ecf97e3ed8e2115eda08ea0f6152206237955030f4304fa2ed93`,
  sourceId `f64d374d1899f3057707528f77703f3f`
- 22 cases, 21 passed; canaries beginning/middle/end all true
- requiredFactAccuracy 0.982, citationPrecision 1.0, citationCompleteness 1.0,
  unsupportedClaimRate 0
- latency p50 1823 ms, p95 2382 ms

**Fixture (offline, deterministic)** — `evals/results/results.json`, generated 2026-08-05T01:11:24Z.
Re-confirmed this session directly from the live `/api/lab` payload:

- 39 cases across 15 categories; router accuracy 39/39 = 1.0 (every per-category accuracy 1.0)
- mode split predicted fast 14 / thinking 25 exactly matches expected; 0 over-escalations, 0 under-escalations
- ranking: 3 cases with an expected top task, all orders correct (`prio-01`, `prio-02`, `prio-03`)
- assertions: 331 run, 0 failed
- coverage: multiHop 16, temporalUpdate 7, contradictionStale 6, entityDedup 5, exactMetadata 6, documentPdf 9

## 8. Current production behaviour (measured 2026-08-06T08:28–08:36Z)

Unchanged from session 1 — same deployment, same defects.

`GET /api/health/live`:

```json
{"status":"live","service":"queueproof-web","time":"2026-08-06T08:28:54.166Z",
 "release":{"commitSha":null,"commitRef":null,"target":"production",
 "deploymentUrl":"queueproof-n1zo1ybn5-vaibhav4046s-projects.vercel.app"}}
```

`GET /api/lab` (`results.*`):

```json
{"currentRelease":{"commitSha":null,"commitRef":null},
 "live":{"status":"awaiting_current_release_measurement","cases":0},
 "pdf":{"status":"awaiting_current_release_measurement","cases":null,"passed":null},
 "modeComparison":{"status":"not_measured","comparable":false,
   "fast":{"status":"not_measured","cases":0,"modeHonored":false},
   "thinking":{"status":"not_measured","cases":0,"modeHonored":false},
   "deltas":null,"rows":[]}}
```

`requestedMode` is `fixture`, and the fixture block *is* fully populated — the fixture suite is
the only thing `/benchmarks` can currently show. Because `commitSha` is null, the
measurement-acceptance contract in `RELEASE_EVIDENCE.md` fails at condition 1, so the
judge-facing page shows **no current-release measured live or PDF results at all**. Release
identity is the blocking defect, not a cosmetic one.

`POST /api/ask` responses observed live this session:

| Question | Result |
| --- | --- |
| "What did we ship most recently and what proves it?" | `ok: true`, `"Insufficient evidence. QueueProof will not invent an answer."`, 0 citations, `missing_information: ["No claim could be supported by the retrieved records."]`, 21.1 s |
| "What is blocking the Atlas launch?" | `ok: true`, 4 citations, 6.2 s — reproduces defect D1 **verbatim** |

`GET /` → 200. `GET /benchmarks` → 200. Production serves live connector data, not a seeded
demo fixture.

## 9. Confirmed defects (evidence attached)

**D1 — grounded synthesis glues unrelated evidence onto the answer. HIGHEST PRIORITY.**
Re-reproduced live at 2026-08-06T08:36Z, byte-identical to the session-1 capture:

```bash
curl -sS -X POST https://queueproof.vercel.app/api/ask \
  -H 'content-type: application/json' \
  -d '{"question":"What is blocking the Atlas launch?","mode":"auto"}'
```

Answer returned (HTTP 200, 6.15 s, 4 citations):

> "Deeside £30,000 - £45,000 a year Easily apply Delivering projects from concept through to
> launch in line with Atlas Copco's lean-agile development process. [1] Priya Raman filed this
> against Atlas Launch. [2] Priya Raman is on it and filed BUG-123 against Atlas Launch. [3]
> Delivering projects from concept through to launch in line with Atlas… 1 day ago [4]"

Citations [1] and [4] are a **job-listing fragment** (Atlas Copco, a different company) pulled
in on the lexical overlap of "Atlas" + "launch". It leads the answer, it repeats at the end,
and the question — what is blocking the launch — is never answered. Claims [2] and [3] are
near-duplicates of each other.

This is the same class as the earlier newsletter-fragment report on "What did we ship most
recently and what proves it?" (the single most damaging known product defect). The earlier fix
`993bd9e` did not eliminate it, and it remains unknown whether `993bd9e` is even deployed —
the running deployment publishes no SHA (D2). The companion symptom is still live too: the
"shipped most recently" question now **abstains with 0 citations**, so neither flagship demo
question currently produces a usable judge-facing answer.

Root-cause candidates to test, in order: (a) entity disambiguation — "Atlas Copco" is a
different entity from "Atlas Launch"; (b) claim-level relevance gating — a claim that answers
no part of the question should not be emitted; (c) cross-claim dedup — [2]/[3] and [1]/[4]
overlap; (d) answer-shape — the answer should lead with the blocker, not with the
highest-scoring excerpt.

**D2 — release identity is null in production. BLOCKING.**
`/api/health/live` returns `commitSha: null, commitRef: null` with `target: "production"` on
deployment `queueproof-n1zo1ybn5-…`, and `/api/lab` echoes `currentRelease.commitSha: null`.
Neither `VERCEL_GIT_COMMIT_SHA` nor `QUEUEPROOF_RELEASE_SHA` is reaching the running
deployment. An earlier deployment did report `aed0278…` / ref `main`, so this is a regression
introduced by how the current deployment was made — most likely a CLI deploy from a directory
with no Git metadata, or a missing `QUEUEPROOF_RELEASE_SHA` env var on the Vercel project.
This blocks `pnpm release:verify`, blocks every submission-gate checkbox that depends on a SHA,
and empties the measured half of `/benchmarks`. The unit contract is already covered —
`tests/health-release.test.ts` passes both cases (Vercel Git metadata preferred;
`QUEUEPROOF_RELEASE_SHA` fallback) — so the defect is in **deployment configuration**, not in
`app/api/health/live/route.ts`.

**D3 — bare `eslint .` fails on generated bundles.**
Re-confirmed this session that `eslint.config.mjs` still has no `dist` entry in its
`globalIgnores([...])` array (it lists `.next/**`, `out/**`, `build/**`, `next-env.d.ts` only).
41 errors, all in `dist/` (table in §6). Intended fix: add a narrow `dist/**` (and, if it
recurs, `.vinext/**`) entry to that existing array. Do **not** relax any source rule and do not
delete the `globalIgnores` override of `eslint-config-next`'s defaults.

**D4 — `.mcp.json` is untracked but not gitignored.**
Re-confirmed: `git check-ignore -v .mcp.json` exits 1 with no output, and `.gitignore` has no
`.mcp.json` entry (it does have `.env*` at line 34 and `/dist/` at line 43). One careless
`git add -A` publishes local MCP server configuration. Add `.mcp.json` to `.gitignore`.

## 10. Disproved defects — do not "fix" these again

**Mid-word truncation ("The lo…") — DISPROVED.** The string came from a diagnostic
`slice(0, 600)` in the investigator's own probe, not from QueueProof output. The speculative
guard added in response was reverted. Re-verified this session:
`grep -rn "slice(0, *600)" lib/server/synthesis.ts packages/retrieval` returns nothing (exit 1).
Do not recreate that fix without a new, reproducible artifact showing QueueProof itself
emitting a truncated word.

**SessionStart hook failure — DOES NOT REPRODUCE.** The hook ran successfully at the start of
both checkpoint sessions. Do not modify the hook without new evidence.

**Markdown run-on — FIXED, but covered by unit regression only.** Re-verified this session:
`tests/synthesis.test.ts:877` — `it("treats every markdown bullet as its own claim boundary", …)`
exists and pinned the behaviour when last run (session 1, passing). The original production
document now produces an **abstaining** answer, so the old live output cannot currently be
reproduced. Report this as unit-regression coverage, never as live reproduction. Note that D1
shows a *different* run-on path is still live (claims [2]/[3] and [1]/[4] duplicate each other).

## 11. MCP state

- Product MCP surface exists: `app/mcp/route.ts` (re-exported by `app/api/mcp/route.ts` as
  `GET`/`POST`/`DELETE`), `app/api/mcp-tokens/`,
  `app/.well-known/oauth-protected-resource/mcp/`, `packages/mcp/`,
  `cli/mcp-client.mjs`, `cli/queueproof.mjs`, `cli/config.mjs`.
- Tests exist: `tests/mcp.test.ts`, `tests/mcp-resource-metadata.test.ts`,
  `tests/cli-mcp-client.test.ts` (`pnpm test:mcp`). Not run in either checkpoint.
- An authenticated MCP client smoke test against production is **still required** before any
  named client is claimed (open item on the `WINNER_STATUS.md` submission gate).
- Local `.mcp.json` configures one server: `perplexity-ask`. It is untracked and must stay so.
- Many connectors in this environment require interactive OAuth and **cannot** be authorised
  non-interactively (this session's harness again reported ~41 servers needing authorisation).
  Do not attempt to authenticate every installed MCP server. Only four matter:
  **QueueProof remote MCP, GitHub, Playwright, Perplexity.** Playwright and the PDF viewer
  connected without auth in this session; the OAuth-gated set did not.

## 12. Connector state

`WINNER_STATUS.md` requires at least three ready connectors with attributable records. Session 1's
live probe returned `provider_coverage: ["gmail","linear","slack"]` on a real question. This
session's Atlas probe returned 4 citations from live connector data but the response body did not
expose a top-level `provider_coverage` field, so per-provider readiness was **not** re-verified
here. GitHub coverage has not been exercised in either checkpoint. Read per-connector readiness
from `/api/health/connectors` and the Sources cards at submission time — a saved credential or a
degraded duplicate does not count as ready.

## 13. Submission state

Target: **HydraDB hackathon** (`docs/HACKATHON_FORM.md`).

Existing copy, all written and release-relative: `docs/SUBMISSION_COPY.md`,
`docs/HACKATHON_FORM.md`, `docs/DEMO_SCRIPT_60S.md` (canonical script;
`submission/60-second-script.md` is an intentional redirect), `docs/JUDGING_MATRIX.md`,
`submission/judge-one-pager.md`, `submission/form-answers.md`,
`submission/requirements-matrix.md`, `submission/technical-deep-dive.md`,
`submission/social-copy.md`, `submission/demo-shot-list.md`.

Submission gate from `WINNER_STATUS.md` — **every box is still unchecked**, and the first three
remain blocked by D2:

- [ ] health endpoint reports a full commit SHA and `production` target ← **blocked by D2**
- [ ] `/api/lab` reports the health SHA in `results.currentRelease.commitSha` ← **blocked by D2**
- [ ] live and PDF results are same-release and `measured` ← **blocked by D2**
- [ ] Fast/Thinking claims made only when `modeComparison.comparable` is true (currently false)
- [ ] ≥3 provider connectors ready with attributable records
- [ ] flagship live question returns cited multi-source evidence ← **blocked by D1**
- [ ] one citation's original-source link resolves
- [ ] every REVIEW, timeout, degraded connector stays visible
- [ ] typecheck, lint, tests, router benchmark, build, E2E, deploy checks pass for the submitted commit
- [ ] authenticated MCP client smoke test recorded
- [ ] GitHub repository opens signed-out — **PENDING, user-only**
- [ ] final 60-second video public and linked — **PENDING, user-only**

`submission/60-second-script.md` and `docs/DEMO_SCRIPT_60S.md` still reconcile spoken metrics
against release `aed0278…`. Those numbers must be re-reconciled against the newly deployed SHA
before recording.

## 14. Remaining tasks, in priority order

1. **Fix D2 — release identity.** Set `QUEUEPROOF_RELEASE_SHA` (and `QUEUEPROOF_RELEASE_REF`)
   on the Vercel production environment, or deploy in a way that supplies
   `VERCEL_GIT_COMMIT_SHA`. Nothing measurable can be certified until `/api/health/live`
   returns a SHA. This unblocks items 6–8.
2. **Fix D1 — grounded synthesis.** Add a failing unit test in `tests/synthesis.test.ts` that
   encodes the Atlas Copco job-listing case *first*, then fix `lib/server/synthesis.ts`
   (entity disambiguation, claim-level relevance gate, cross-claim dedup, answer shape). Also
   cover the abstain-on-"what did we ship most recently" case: an evidence-backed answer should
   be produced when a system-of-record delivery assertion exists, and abstention kept when it
   does not. Re-probe production after deploy with the exact curl in §9.
3. **Fix D3 — eslint.** Add `dist/**` to `globalIgnores` in `eslint.config.mjs`. Confirm
   `node ./node_modules/eslint/bin/eslint.js .` reports 0 errors and source rules are unchanged.
4. **Fix D4** — add `.mcp.json` to `.gitignore`.
5. **Resolve the uncommitted CSS** (§4): finish or revert; verify dropdown contrast in the browser first.
6. **Run full release gates** for the submitted commit:
   `pnpm typecheck` → `pnpm lint` → `pnpm test` → `pnpm benchmark:router` → `pnpm build` →
   `pnpm deploy:check`. Paste real output. The full 48-file suite has not been run in either
   checkpoint, so budget for first-run failures.
7. **Push and deploy.** `codex/dialog-autofocus` is 1 commit ahead of the `github` remote
   (2 after this checkpoint commit) — push first, then deploy, then
   `pnpm release:verify -- --url https://queueproof.vercel.app --sha <HEAD>`.
8. **Re-measure on the deployed SHA:** `pnpm benchmark:live`, `pnpm benchmark:pdf`, then
   `pnpm benchmark:publish`. Confirm `/api/lab` reports the same SHA and `/benchmarks` shows
   measured rows. Run both explicit modes if a Fast-vs-Thinking claim is wanted
   (`modeComparison.comparable` must become true).
9. **Record an authenticated MCP client smoke test** against production.
10. **Decide the branch strategy**: 39 commits sit on `codex/dialog-autofocus` ahead of `main`.
    Either submit from this branch or merge to `main` before publication.
11. **Refresh submission copy** with the new SHA and the new measured numbers; re-reconcile
    `docs/DEMO_SCRIPT_60S.md`.
12. **Produce the 60-second video script** and the final submission copy for the user to record.

## 15. User-only actions (do not attempt autonomously)

- OAuth consent for any connector or MCP server that requires an interactive grant.
- Attio credential rotation.
- Authorising the GitHub repository to be made **public** (currently PRIVATE).
- Recording and uploading the final 60-second video.

## 16. Files modified in this checkpoint

Only continuity documentation:

- `docs/continuity/QUEUEPROOF_STATE.md` (rewritten)
- `docs/continuity/QUEUEPROOF_STATE.json` (rewritten)
- `docs/continuity/NEXT_SESSION_PROMPT.md` (rewritten)
- `docs/continuity/DECISIONS.md` — reviewed, **unchanged**: it is durable-only and nothing was
  decided or rejected this session.

No product implementation file was touched. `app/globals.css` and `app/product.css` remain
uncommitted exactly as found; `.mcp.json` remains untracked and unstaged.

## 17. Architecture decisions that matter here

- **Evidence-first.** An answer exists only as claims bound to retained receipts. Abstaining
  ("Insufficient evidence. QueueProof will not invent an answer.") is a correct output, not a bug.
- **Release-bound measurement.** No historical SHA, latency, pass count or cost may be reused.
  `/api/health/live` and `/api/lab` are the only authorities (`RELEASE_EVIDENCE.md`).
- **Owner boundary.** Credentials, connector control, uploads, proposal history, approvals,
  token administration and external execution are owner-only and enforced server-side. The UI
  no longer nags for an owner token; that is a UI change only.
- **MCP is read-only.** Same bounded read contract as the product; writes stay behind approval.
- **Vercel builds from source.** `.vercelignore` excludes local build output because a held
  handle on `.next`/`.wrangler` breaks upload on Windows with `EBUSY`.
- Runtime: Next 16 via `vinext` + Vite, React 19, Drizzle, Wrangler for local `start`,
  pnpm 10.33.0, Node ≥ 22.13.

Full rationale, including rejected approaches, lives in `DECISIONS.md`.

## 18. Exact next command

```bash
cd "D:/Codex d;/queueproof" && curl -sS https://queueproof.vercel.app/api/health/live
```

If `release.commitSha` is still `null`, D2 is unfixed and it is the first task. Next file to
inspect: `app/api/health/live/route.ts` — confirm which env vars it reads, then set the
matching variable on the Vercel production environment (the unit tests in
`tests/health-release.test.ts` already prove the route logic is correct, so the fix belongs in
deployment configuration).
