# QueueProof — continuity state

**Checkpoint written:** 2026-08-06T02:36:51Z (session 1)
**Status:** ACTIVE — implementation continues in a fresh session.

Every claim below was verified in this checkpoint session by running the command shown.
Anything not verified is labelled **UNVERIFIED**. Do not promote an unverified line to a
fact without re-running its check.

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
| Repository | https://github.com/vaibhav4046/queueproof — **PRIVATE** (`gh repo view` → `"visibility":"PRIVATE"`) |
| Production | https://queueproof.vercel.app (HTTP 200) |
| Benchmarks | https://queueproof.vercel.app/benchmarks (HTTP 200) |
| Release identity | https://queueproof.vercel.app/api/health/live |
| Current-release measurements | https://queueproof.vercel.app/api/lab |

Git remotes: `github` → GitHub; `sites` → a ChatGPT-sandbox mirror (`git.chatgpt-team.site`).
Push work to `github`. The `sites` remote is not project-controlled infrastructure.

## 4. Current branch, commit, worktree

```
cwd     D:\Codex d;\queueproof
branch  codex/dialog-autofocus
HEAD    993bd9ee52eb3d284d484ea6c9b858daed89cf8c  "fix: stop duplicate and run-on claims in grounded answers"
remote  in sync with github/codex/dialog-autofocus (rev-list --left-right --count → 0 0)
main    a884e8d — HEAD is 38 commits AHEAD of main
```

**Worktree is NOT clean.** Uncommitted at checkpoint time (deliberately left in place; the
checkpoint commit contains continuity docs only):

- `M app/globals.css` — `.queue-toolbar` label font 7px→10px, select font 8px→12px, padding widened.
- `M app/product.css` — removed the forced light `select` colour block (`color: var(--paper)`,
  `background-color:#fff`, `color-scheme: light`, and the `select` / `select option` rules).
- `?? .mcp.json` — **untracked and NOT gitignored.** Contains a `perplexity-ask` server entry.
  Never commit it. Adding it to `.gitignore` is a pending task (§10).

These two CSS edits are an unfinished dropdown-legibility change. Decide deliberately: finish
and commit them, or `git checkout -- app/globals.css app/product.css`. Removing the light
`color-scheme` on `select` may regress dropdown contrast on dark backgrounds — verify in the
browser before committing.

## 5. Completed work (verified)

- 38 commits on `codex/dialog-autofocus` beyond `main`, most recently:
  - `993bd9e` stop duplicate and run-on claims in grounded answers (`lib/server/synthesis.ts` +59 test lines)
  - `0098552` stop uploading local build output to Vercel (`.vercelignore` now excludes `.next`, `.vinext`, `.wrangler`, `dist`, `out`, `coverage`, logs, secrets)
  - `27b6ab7` require a system-of-record delivery assertion, not a bare participle
  - `9469b5b` refuse to answer delivery questions from prose that only mentions the verb
  - `c70b8fe` expand frozen benchmark with recency routing and synthesis cases
  - `87a255e` render the queue on first paint and decouple its fetch
  - `f5fe0e1` answer most-recently questions with the newest evidence
  - `3a44895` open the workspace to every visitor and repair two real defects
- UI owner-token nags removed while server-side write protection was preserved.
  Verified: `grep -n "owner token\|ownerToken" app/QueueProofApp.tsx` → no matches.
- Platform-aware Ctrl/Command labels implemented.
  Verified: `app/QueueProofApp.tsx:230-236` — SSR renders "Ctrl", upgraded to `⌘` after mount
  via `readApplePlatform()`; `Cmd/Ctrl+K` and `Cmd/Ctrl+Enter` handlers at lines 413 and 1192.
- Meaningful empty-body API errors implemented previously (**UNVERIFIED in this checkpoint** —
  re-check `tests/api-hardening.test.ts` before claiming it).
- 48 test files under `tests/`; 9 workspace packages under `packages/`
  (actions, connectors, contracts, graph, hydradb, mcp, ranking, retrieval, security).

## 6. Verified tests (run in this checkpoint)

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

The full suite was **not** re-run in this checkpoint. Its current pass count is **UNVERIFIED**.

Lint state, verified:

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

Non-generated files with errors: **0**. `dist/` is in `.gitignore` and in `.vercelignore`;
`package.json`'s `lint` script already passes `--ignore-pattern dist --ignore-pattern .next`,
so only the bare `eslint .` invocation fails.

## 7. Verified benchmarks (local artifacts, historical release)

All three artifacts below were produced against release
`aed027879150e3e324b54c5ec2194d4d715c501e` (ref `main`) — **not** the current HEAD. They are
provenance, not current-release measurements.

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

**Fixture (offline, deterministic)** — `evals/results/results.json`, generated 2026-08-05T01:11:24Z:

- 39 cases across 15 categories; router accuracy 39/39 = 1.0
- mode split predicted fast 14 / thinking 25 exactly matches expected; 0 over-escalations, 0 under-escalations
- ranking: 3 cases with an expected top task, all orders correct

## 8. Current production behaviour (measured 2026-08-06T02:29–02:33Z)

`GET /api/health/live`:

```json
{"status":"live","service":"queueproof-web","time":"2026-08-06T02:29:50.708Z",
 "release":{"commitSha":null,"commitRef":null,"target":"production",
 "deploymentUrl":"queueproof-n1zo1ybn5-vaibhav4046s-projects.vercel.app"}}
```

`GET /api/lab`:

```json
{"currentRelease":{"commitSha":null,"commitRef":null},
 "live":{"status":"awaiting_current_release_measurement","cases":0},
 "pdf":{"status":"awaiting_current_release_measurement","cases":null,"passed":null},
 "modeComparison":{"status":"not_measured","comparable":false}}
```

Because `commitSha` is null, the measurement-acceptance contract in `RELEASE_EVIDENCE.md`
fails at condition 1, so the judge-facing `/benchmarks` page shows **no current-release
measured results at all**. Release identity is therefore the blocking defect, not a cosmetic one.

`POST /api/ask` responses observed live:

| Question | Result |
| --- | --- |
| "What did we ship most recently and what proves it?" | `"Insufficient evidence. QueueProof will not invent an answer."`, 0 citations |
| "What is blocking the Atlas launch?" | `ok: true`, 4 citations, provider coverage gmail+linear+slack, 1 HydraDB call, 7245 ms |

The second answer reproduces the flagship synthesis defect verbatim (§9, defect D1).

`GET /` → 200. `GET /benchmarks` → 200. Production serves live connector data (Gmail, Linear,
Slack), not a seeded demo fixture.

## 9. Confirmed defects (evidence attached)

**D1 — grounded synthesis glues unrelated evidence onto the answer. HIGHEST PRIORITY.**
Reproduced live at 2026-08-06T02:32Z:

```bash
curl -sS -X POST https://queueproof.vercel.app/api/ask \
  -H 'content-type: application/json' \
  -d '{"question":"What is blocking the Atlas launch?","mode":"auto"}'
```

Answer returned:

> "Deeside £30,000 - £45,000 a year Easily apply Delivering projects from concept through to
> launch in line with Atlas Copco's lean-agile development process. [1] Priya Raman filed this
> against Atlas Launch. [2] Priya Raman is on it and filed BUG-123 against Atlas Launch. [3]
> Delivering projects from concept through to launch in line with Atlas… 1 day ago [4]"

Citations [1] and [4] are a **job-listing fragment** (Atlas Copco, a different company) pulled
in on the lexical overlap of "Atlas" + "launch". It leads the answer, it repeats at the end,
and the question — what is blocking the launch — is never answered directly. Claims [2] and [3]
are near-duplicates of each other. This is the same class as the newsletter-fragment defect
recorded earlier; the earlier fix (`993bd9e`) did not eliminate it in production. It is unknown
whether `993bd9e` is even deployed (see D2).

Root-cause candidates to test, in order: (a) entity disambiguation — "Atlas Copco" is a
different entity from "Atlas Launch"; (b) claim-level relevance gating — a claim that answers
no part of the question should not be emitted; (c) cross-claim dedup — [2]/[3] and [1]/[4]
overlap; (d) answer-shape — the answer should lead with the blocker, not with the
highest-scoring excerpt.

**D2 — release identity is null in production.**
`/api/health/live` returns `commitSha: null, commitRef: null` with `target: "production"`.
Neither `VERCEL_GIT_COMMIT_SHA` nor `QUEUEPROOF_RELEASE_SHA` is reaching the running
deployment (`queueproof-n1zo1ybn5-…`). An earlier deployment did report
`aed027879150e3e324b54c5ec2194d4d715c501e` / ref `main`, so this is a regression introduced by
how the current deployment was made — most likely a CLI deploy from a directory with no Git
metadata, or a missing `QUEUEPROOF_RELEASE_SHA` env var on the Vercel project.
This blocks `pnpm release:verify`, blocks every submission-gate checkbox that depends on a SHA,
and empties `/benchmarks`. The unit contract is already covered — `tests/health-release.test.ts`
passes both cases (Vercel Git metadata preferred; `QUEUEPROOF_RELEASE_SHA` fallback) — so the
defect is in **deployment configuration**, not in `app/api/health/live/route.ts`.

**D3 — bare `eslint .` fails on generated bundles.**
41 errors, all in `dist/` (table in §6). Intended fix: add a narrow `dist/**` (and, if it
recurs, `.vinext/**`) entry to the existing `globalIgnores([...])` array in
`eslint.config.mjs`. Do **not** relax any source rule and do not delete the
`globalIgnores` override of `eslint-config-next`'s defaults.

**D4 — `.mcp.json` is untracked but not gitignored.**
`git check-ignore -v .mcp.json` returns nothing. One careless `git add -A` publishes local MCP
server configuration. Add `.mcp.json` to `.gitignore`.

## 10. Disproved defects — do not "fix" these again

**Mid-word truncation ("The lo…") — DISPROVED.** The string came from a diagnostic
`slice(0, 600)` in the investigator's own probe, not from QueueProof output. The speculative
guard added in response was reverted. Verified in this checkpoint: no `slice(0, 600)` or
truncation guard remains in `lib/server/synthesis.ts` or `packages/retrieval`. Do not recreate
that fix without a new, reproducible artifact showing QueueProof itself emitting a truncated word.

**SessionStart hook failure — DOES NOT REPRODUCE.** The hook ran successfully at the start of
this checkpoint session. Do not modify the hook without new evidence.

**Markdown run-on — FIXED, but covered by unit regression only.** `tests/synthesis.test.ts`
("treats every markdown bullet as its own claim boundary", ~line 877) is passing and pins the
behaviour. The original production document now produces an **abstaining** answer, so the old
live output cannot currently be reproduced. Report this as unit-regression coverage, never as
live reproduction. Note that D1 shows a *different* run-on path is still live.

## 11. MCP state

- Product MCP surface exists: `app/mcp/route.ts` (re-exported by `app/api/mcp/route.ts` as
  `GET`/`POST`/`DELETE`), `app/api/mcp-tokens/`,
  `app/.well-known/oauth-protected-resource/mcp/`, `packages/mcp/`,
  `cli/mcp-client.mjs`, `cli/queueproof.mjs`, `cli/config.mjs`.
- Tests exist: `tests/mcp.test.ts`, `tests/mcp-resource-metadata.test.ts`,
  `tests/cli-mcp-client.test.ts` (`pnpm test:mcp`). Not run in this checkpoint.
- An authenticated MCP client smoke test against production is **still required** before any
  named client is claimed (open item on the `WINNER_STATUS.md` submission gate).
- Local `.mcp.json` configures one server: `perplexity-ask`. It is untracked and must stay so.
- Many claude.ai connectors in this environment require interactive OAuth and **cannot** be
  authorised non-interactively. Do not attempt to authenticate every installed MCP server.
  Only four matter: **QueueProof remote MCP, GitHub, Playwright, Perplexity.**

## 12. Connector state

`WINNER_STATUS.md` requires at least three ready connectors with attributable records. The live
`/api/ask` probe in §8 returned `provider_coverage: ["gmail","linear","slack"]` on a real
question, so at least three providers are returning evidence in production right now. GitHub
coverage was **not** exercised in this checkpoint. Per-connector readiness and degraded state
must be read from `/api/health/connectors` and the Sources cards at submission time — a saved
credential or a degraded duplicate does not count as ready.

## 13. Submission state

Target: **HydraDB hackathon** (`docs/HACKATHON_FORM.md`).

Existing copy, all written and release-relative: `docs/SUBMISSION_COPY.md`,
`docs/HACKATHON_FORM.md`, `docs/DEMO_SCRIPT_60S.md` (canonical script;
`submission/60-second-script.md` is an intentional redirect), `docs/JUDGING_MATRIX.md`,
`submission/judge-one-pager.md`, `submission/form-answers.md`,
`submission/requirements-matrix.md`, `submission/technical-deep-dive.md`,
`submission/social-copy.md`, `submission/demo-shot-list.md`.

Submission gate from `WINNER_STATUS.md` — **every box is still unchecked**, and the first three
are blocked by D2:

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

`submission/60-second-script.md` still reconciles its spoken metrics against release
`aed0278…`. Those numbers must be re-reconciled against the newly deployed SHA before recording.

## 14. Remaining tasks, in priority order

1. **Fix D2 — release identity.** Set `QUEUEPROOF_RELEASE_SHA` (and `QUEUEPROOF_RELEASE_REF`)
   on the Vercel production environment, or deploy in a way that supplies
   `VERCEL_GIT_COMMIT_SHA`. Nothing measurable can be certified until `/api/health/live`
   returns a SHA. This unblocks items 5–7.
2. **Fix D1 — grounded synthesis.** Add a failing unit test in `tests/synthesis.test.ts` that
   encodes the Atlas Copco job-listing case *first*, then fix `lib/server/synthesis.ts`
   (entity disambiguation, claim-level relevance gate, cross-claim dedup, answer shape).
   Re-probe production after deploy with the exact curl in §9.
3. **Fix D3 — eslint.** Add `dist/**` to `globalIgnores` in `eslint.config.mjs`. Confirm
   `node ./node_modules/eslint/bin/eslint.js .` reports 0 errors and that source rules are unchanged.
4. **Fix D4** — add `.mcp.json` to `.gitignore`.
5. **Resolve the uncommitted CSS** (§4): finish or revert; verify dropdown contrast in the browser first.
6. **Run full release gates** for the submitted commit:
   `pnpm typecheck` → `pnpm lint` → `pnpm test` → `pnpm benchmark:router` → `pnpm build` →
   `pnpm deploy:check`. Paste real output.
7. **Deploy**, then `pnpm release:verify -- --url https://queueproof.vercel.app --sha <HEAD>`.
8. **Re-measure on the deployed SHA:** `pnpm benchmark:live`, `pnpm benchmark:pdf`, then
   `pnpm benchmark:publish`. Confirm `/api/lab` reports the same SHA and `/benchmarks` shows
   measured rows. Run both explicit modes if a Fast-vs-Thinking claim is wanted
   (`modeComparison.comparable` must become true).
9. **Record an authenticated MCP client smoke test** against production.
10. **Decide the branch strategy**: 38 commits sit on `codex/dialog-autofocus` ahead of `main`.
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

- `docs/continuity/QUEUEPROOF_STATE.md` (new)
- `docs/continuity/QUEUEPROOF_STATE.json` (new)
- `docs/continuity/DECISIONS.md` (new)
- `docs/continuity/NEXT_SESSION_PROMPT.md` (new)

No product implementation file was touched. `app/globals.css` and `app/product.css` remain
uncommitted exactly as found.

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

## 18. Exact next command

```bash
cd "D:/Codex d;/queueproof" && curl -sS https://queueproof.vercel.app/api/health/live
```

If `release.commitSha` is still `null`, D2 is unfixed and it is the first task. Next file to
inspect: `app/api/health/live/route.ts` — confirm which env vars it reads, then set the
matching variable on the Vercel production environment (the unit tests in
`tests/health-release.test.ts` already prove the route logic is correct, so the fix belongs in
deployment configuration).
