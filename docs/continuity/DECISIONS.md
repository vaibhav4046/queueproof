# QueueProof — durable decisions

Only decisions that outlive a session belong here: why the product exists, what it refuses to
be, and which approaches were tried and rejected. Anything volatile (branch, SHA, defect list,
task order) lives in `QUEUEPROOF_STATE.md` / `.json` instead.

---

## 1. Why the product exists

Work evidence is scattered across GitHub, Linear, Slack, Gmail and documents. The question a
person actually has — "what is blocking this?", "what did we ship?" — is answerable only by
someone who reads all five and remembers what they saw. Generic AI assistants answer the same
question fluently and unverifiably: no receipt, no way to tell a real answer from a plausible one.

QueueProof exists to make the answer **checkable in one click**. Its differentiator is not
better prose; it is that every claim opens to the record it came from.

## 2. What QueueProof is, and is not

**Is:** a daily evidence workspace. One question in; one concise answer out, with per-claim
citation receipts (provider, timestamp, excerpt, receipt ID, original link), an
evidence-backed priority queue, and a reviewable next-action brief.

**Is not:** a chatbot, a search box, or an autonomous agent. It does not chat, it does not
return ten blue links, and it does not act on the user's behalf without approval.

**Consequence:** feature requests that would make it a general assistant are out of scope.
Every surface must trace back to Ask → Proof → Sources → Proof tests → Connect AI.

## 3. Evidence-first answer architecture

Non-negotiable properties of an answer:

- **Every claim is bound to a retained receipt.** A sentence with no citation must not ship.
- **Abstention is a correct output.** `"Insufficient evidence. QueueProof will not invent an
  answer."` is a feature. Never tune it away to raise a pass rate.
- **Contradictions are preserved, not smoothed.** If two sources disagree, both are shown.
- **Missing evidence is named**, not silently omitted.
- **Routing is explained.** Auto/Fast/Thinking each emit a `routing_reason` plus a
  `retrieval_receipt` (HydraDB call count, latency, provider coverage, estimated cost units).

Rejected alternative: a single always-deep mode. It was slower and no more accurate on the
fixture set, and it destroyed the cost story. Routing with a stated reason was kept instead.

## 4. Release-bound measurement

**Decision: a measurement is valid only if it was taken against the currently deployed release.**

- `/api/health/live` publishes the release identity (`commitSha`, `commitRef`, `target`).
- `/api/lab` must echo the same SHA in `results.currentRelease.commitSha`.
- If the SHAs disagree, or either is absent, every measured surface degrades to
  `awaiting_current_release_measurement` and `/benchmarks` shows nothing.

This is deliberately brittle. Showing an empty benchmarks page is the correct behaviour; showing
a stale number without saying which build produced it is not. **No historical SHA, latency,
pass count or cost may be reused across releases.** `scripts/release-gate.mjs` enforces the SHA
match plus route reachability before a release is called verified.

Rejected alternative: publishing "last known good" numbers with a timestamp. It reads as current
to a judge and is exactly the unverifiable-claim failure the product was built to refuse.

## 5. Authentication and approval boundaries

- The workspace is **open to every visitor** for reading. Ask, Proof, Sources and Proof tests
  need no account (`3a44895`).
- **Owner-only, enforced server-side:** credentials, connector control, uploads, proposal
  history, approvals, MCP token administration, and any external write.
- **Writes are proposals until a human approves them.** A write counts as executed only after a
  provider response ID is stored. No optimistic "done".
- UI owner-token nags were removed; server-side protection was **not** relaxed. If a future
  change touches this, the UI change and the enforcement change are separate decisions —
  do not treat the nag removal as precedent for loosening the server boundary.
- Never paste a secret into a chat transcript. Credentials go into the deployment environment
  or a local `.env`, both gitignored.

## 6. MCP product boundary

- MCP exposes the **same bounded read contract** as the product: ask, evidence, receipts.
  Writes stay behind the approval boundary and are not reachable over MCP.
- OAuth protected-resource metadata is served at
  `app/.well-known/oauth-protected-resource/mcp`, so clients discover the auth model rather
  than being handed a token.
- Only four MCP services matter to this project: **QueueProof remote MCP, GitHub, Playwright,
  Perplexity.** Servers requiring interactive OAuth cannot be authorised non-interactively —
  do not burn a session trying to authenticate every installed server.

## 7. UI direction

- Judge path is fixed and ordered: **Ask → Proof → Sources → Proof tests → Connect AI.**
- Claims are the interactive unit. A citation marker opens the receipt; the receipt links out
  to the original record.
- Degraded state is shown, never hidden: `REVIEW` rows, timeouts and degraded connectors stay
  visible on `/benchmarks` and in the Sources cards.
- The queue renders on first paint and fetches independently (`87a255e`) — a blank queue while
  data loads reads as an empty product.
- Keyboard affordances name the key the visitor actually has: `Ctrl` rendered server-side,
  upgraded to `⌘` after mount so SSR and client markup agree.

## 8. Benchmark principles

- **Three suites, three jobs.** Fixture (offline, deterministic, 39 cases) proves routing and
  ranking. Live (production, graded) proves grounded answering across providers. PDF (346-page
  handbook with beginning/middle/end canaries) proves long-document retrieval.
- **A failing case stays in the set.** 4/6 live and 21/22 PDF are published as-is. Removing a
  case to raise a number is forbidden.
- **A mode comparison is only claimed when `modeComparison.comparable` is true.** If a run
  executed only Fast, no Fast-vs-Thinking statement may be made — the demo script already
  carries the instruction "Do not say Fast and Thinking achieved the same result."
- Grader version is recorded with the run (`grounded-grader-v2`); changing the grader
  invalidates comparison with earlier runs.

## 9. Corrections that must not be reversed

1. **Mid-word truncation was disproved.** `"The lo"` came from a diagnostic `slice(0, 600)`,
   not from QueueProof output. The speculative guard was reverted. Do not recreate that fix
   without new reproducible evidence.
2. **The markdown run-on fix is unit-regression coverage, not live reproduction.** The original
   document now abstains, so the old live output cannot be reproduced. Describe it accurately.
3. **Release identity (`commitSha`) is a verified defect** until a live deployment proves
   otherwise. Re-check `/api/health/live` before assuming it is fixed.
4. **The eslint fix is a narrow `globalIgnores` entry for generated `dist/**` output** — proven
   generated first. Do not weaken source lint rules and do not delete the `globalIgnores`
   override of `eslint-config-next` defaults.
5. **The SessionStart hook failure does not reproduce.** Do not modify the hook without new evidence.
6. **Do not attempt to authenticate every installed MCP server.** OAuth servers cannot be
   authorised non-interactively; only the four named in §6 matter.
7. **User-controlled actions stay with the user:** OAuth consent, Attio credential rotation,
   authorising the repository to go public, recording and uploading the video.
8. **UI owner-token nags were removed while server-side write protection was preserved.**
9. **Platform-aware Ctrl/Command labels and meaningful empty-body API errors were already
   implemented.** Do not re-implement them.
10. **The most damaging known product defect is grounded synthesis on questions like "What did
    we ship most recently and what proves it?"** — a production answer combined unrelated
    newsletter fragments and never answered the question. The same class is still live
    (Atlas Copco job listing cited as evidence for "What is blocking the Atlas launch?").
    Treat this as the top product defect until a live probe proves otherwise.

## 10. Approaches tried and rejected

| Tried | Outcome |
| --- | --- |
| Speculative output-truncation guard in `lib/server/synthesis.ts` | **Reverted.** Fixed a defect that did not exist; the artifact was a diagnostic `slice(0, 600)`. Lesson: reproduce against production before patching. |
| Answering delivery questions from prose that merely contains the verb ("shipping", "launched") | **Rejected** (`9469b5b`, `27b6ab7`). A system-of-record assertion is now required; marketing prose no longer counts as delivery evidence. |
| Uploading local build output to Vercel | **Rejected** (`0098552`). `.vercelignore` now excludes `.next`, `.vinext`, `.wrangler`, `dist`, `out`, `coverage`, logs and `.env*` — a held handle on those directories caused `EBUSY` on Windows `vercel deploy`. Vercel builds from source. |
| Gating the workspace behind an owner token in the UI | **Rejected** (`3a44895`). Nobody could evaluate the product. Reading is open; the server-side write boundary carries the security. |
| Publishing benchmark numbers from a previous release | **Rejected.** See §4. An empty `/benchmarks` is preferable to an unattributed number. |
| Full-suite Vitest with default parallelism | **Rejected.** The suite runs single-worker with `--fileParallelism=false`; parallel workers were unstable on this host. |

## 11. Stack decisions

- **Next.js 16 built with `vinext` + Vite**, React 19, served locally through Wrangler,
  deployed to Vercel. Node ≥ 22.13, pnpm 10.33.0 workspace.
- **HydraDB is the cross-source evidence layer** — the reason the project qualifies for the
  hackathon and the reason receipts are retrievable at all.
- **Drizzle ORM + Zod** for schema and boundary validation; **pino** for structured logs.
- Workspace packages are split by responsibility: `actions`, `connectors`, `contracts`,
  `graph`, `hydradb`, `mcp`, `ranking`, `retrieval`, `security`.
- `BUILD_STATUS.md` and `AUTH_REQUIRED.md` are **archived history**. Never quote them as
  current state; `RELEASE_EVIDENCE.md` and `WINNER_STATUS.md` are the live contracts.
