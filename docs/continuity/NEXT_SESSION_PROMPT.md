# QueueProof — next session prompt

Paste the block below into a **fresh** Claude Code session opened at `D:\Codex d;\queueproof`.

---

Read the QueueProof Project Instructions and all files under `docs/continuity/`. Verify git
status and current HEAD, then continue the highest-priority executable task from
`QUEUEPROOF_STATE.json`.

Do not restart completed work or produce another broad plan.

Work through implementation, testing, deployment, production verification, benchmarking and
submission. Maintain the continuity files after every major phase. Before any usage or context
limit, create a safe checkpoint and stop.

When all autonomous completion criteria pass, set the project state to DONE, stop generating
continuation prompts and return the live product, benchmark, repository, MCP and submission links.

---

## Context you need before the first command

**QueueProof** is a daily evidence workspace and the entry for the **HydraDB hackathon**. One
plain-language question is answered across GitHub, Linear, Slack, Gmail and uploaded documents.
Every claim opens to a retained receipt (provider, timestamp, excerpt, original link).
Contradictions are preserved, missing evidence is named, and abstaining
("Insufficient evidence. QueueProof will not invent an answer.") is a correct output.
Reading is open to everyone; credentials, connectors, uploads, approvals and external writes are
owner-only and enforced server-side. The same bounded **read** contract is exposed over MCP.

- Repo `https://github.com/vaibhav4046/queueproof` (**PRIVATE**) · Production
  `https://queueproof.vercel.app` · Benchmarks `https://queueproof.vercel.app/benchmarks`
- Branch `codex/dialog-autofocus`, HEAD `993bd9e`, **38 commits ahead of `main`**, in sync with
  the `github` remote. Worktree is **not** clean: `app/globals.css` and `app/product.css` carry
  an unfinished dropdown-legibility edit, and `.mcp.json` is untracked and not gitignored.
- Session 1 was a checkpoint only. **No product code was changed in it.**

## How to work

1. **Read the continuity files first**, in this order: `QUEUEPROOF_STATE.md` (full verified
   state), `QUEUEPROOF_STATE.json` (machine-readable task queue), `DECISIONS.md` (what must not
   be reversed). Read `RELEASE_EVIDENCE.md` and `WINNER_STATUS.md` for the live contracts.
   `BUILD_STATUS.md` and `AUTH_REQUIRED.md` are archived history — never quote them as current.

2. **Verify before trusting.** Run `git status --short`, `git branch --show-current`,
   `git log -5 --oneline`, and hit `/api/health/live` and `/api/lab` on production. The state
   files were accurate at 2026-08-06T02:36Z; production and the worktree may have moved. Lines
   marked **UNVERIFIED** in `QUEUEPROOF_STATE.md` are exactly that — re-check them before
   repeating them.

3. **Continue the highest-priority executable task**, currently P1 in
   `QUEUEPROOF_STATE.json`: production `/api/health/live` returns `commitSha: null`, which
   empties the entire judge-facing benchmark surface. The route logic is already unit-proven
   (`tests/health-release.test.ts` passes both the Vercel-Git-metadata and
   `QUEUEPROOF_RELEASE_SHA` fallback cases), so the fix belongs in **deployment configuration**,
   not in `app/api/health/live/route.ts`.

4. **Do not redo completed work.** Owner-token nag removal, platform-aware Ctrl/⌘ labels, the
   markdown run-on fix, the `.vercelignore` fix and the 39-case fixture benchmark are done.
   Three reported defects are **disproved** and must not be "fixed" again — see §10 of
   `QUEUEPROOF_STATE.md` and §9 of `DECISIONS.md`.

5. **Use targeted tests while developing.** Example:
   ```bash
   node ./node_modules/vitest/vitest.mjs run --config vitest.config.ts tests/synthesis.test.ts --pool=threads --maxWorkers=1 --fileParallelism=false
   ```
   The suite must stay single-worker. For a synthesis fix, write the failing test **first**.

6. **Run the full release gate before deploying**, in order, and paste the real output:
   ```bash
   pnpm typecheck && pnpm lint && pnpm test && pnpm benchmark:router && pnpm build && pnpm deploy:check
   ```
   Never claim a gate passed without its output.

7. **Update the continuity files after every completed phase** — at minimum `head`,
   `productionSha`, `worktreeClean`, `completed`, `remaining`, `lastProgress`, `nextAction`,
   `updatedAt` in the JSON, and the matching sections of the Markdown. Commit continuity docs
   separately from product changes. **Never commit** `.mcp.json`, `.env*`, credentials, browser
   profiles, raw connector records or temporary test output.

8. **Deploy and production-test the final HEAD.** After deploying:
   ```bash
   pnpm release:verify -- --url https://queueproof.vercel.app --sha <HEAD>
   ```
   Then re-measure on that SHA (`pnpm benchmark:live`, `pnpm benchmark:pdf`,
   `pnpm benchmark:publish`) and confirm `/api/lab` reports the same SHA with measured rows.
   No historical measurement may be reused across releases. Re-probe the flagship question live:
   ```bash
   curl -sS -X POST https://queueproof.vercel.app/api/ask -H 'content-type: application/json' -d '{"question":"What is blocking the Atlas launch?","mode":"auto"}'
   ```

9. **Produce the submission copy and the 60-second video script** once the numbers are
   current-release valid. `docs/DEMO_SCRIPT_60S.md` is canonical and currently pins its spoken
   metrics to release `aed0278` — re-reconcile every number against the new SHA. Only claim a
   Fast-vs-Thinking difference when `modeComparison.comparable` is true.

10. **Leave user-only actions to the user** and say so plainly: interactive OAuth consent, Attio
    credential rotation, authorising the repository to go public, recording and uploading the
    video. Do not attempt to authenticate every installed MCP server; only QueueProof remote
    MCP, GitHub, Playwright and Perplexity matter.

11. **Stop when done.** When every `WINNER_STATUS.md` gate item that is not user-only passes,
    set `status` to `DONE` in `QUEUEPROOF_STATE.json`, stop generating continuation prompts, and
    return the live product, benchmark, repository, MCP and submission links plus the exact list
    of remaining user-only actions.

## First command

```bash
cd "D:/Codex d;/queueproof" && git status --short && git log -3 --oneline && curl -sS https://queueproof.vercel.app/api/health/live
```
