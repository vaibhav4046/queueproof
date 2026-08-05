# QueueProof — Feature Truth Table

> [!WARNING]
> **SUPERSEDED — HISTORICAL FORENSIC SNAPSHOT.** This table assesses the 31 July 2026
> committed/deployed artifact while another recovery change was in flight. Its feature states,
> test totals, line numbers, and deployment conclusions are not current release evidence. Use
> [`../RELEASE_EVIDENCE.md`](../RELEASE_EVIDENCE.md) and the maintained
> [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).

Read-only forensic audit. No source file was modified.
Companion to `REPOSITORY_MAP.md`.

**Test suite actually executed** (not inferred): `vitest run` → **7 files, 67 tests, all passing, 1.41s**.
Files: `retrieval` (6), `eval-fixtures` (33), `cli-config` (5), `security` (13), `ranking` (4), `contracts` (4), `mcp` (2).

> ### ⚠ The working tree changed during this audit
> `lib/server/runtime-vercel.ts` was rewritten and `lib/server/d1-compat.ts` (14.6 KB) was created at **20:37–20:38**, mid-audit, by a concurrent process — not by this audit. `git status` shows 10 modified and 7 untracked paths. All findings below describe the **committed / deployed** artifact, which is what `queueproof.vercel.app` serves. The in-flight change is assessed separately in §3.

---

## 1. Truth table

Legend — **Status**: `LIVE` works in a correctly-provisioned environment · `LOCAL-ONLY` works only under Wrangler/Miniflare · `DEAD` code exists but is unreachable · `ABSENT` not implemented · `THEATRE` presented to a consumer as working while returning invented or empty results.

| Feature | Claimed | Code path | UI path | Test | Real or Fixture | Status | Blocker |
|---|---|---|---|---|---|---|---|
| **Workspace creation** | Yes | `app/api/workspace/route.ts:54-96` | `QueueProofApp.tsx:269` | none | Real | LOCAL-ONLY | `:56` returns 503 without D1 |
| **HydraDB account attach** | Yes | `app/api/hydradb/configure/route.ts` | `QueueProofApp.tsx:405` | none | Real (AES-GCM, `crypto.ts:32`) | LOCAL-ONLY | needs D1 to store key |
| **Provider catalogue** | Yes | `app/api/providers/route.ts:16,30` | `SourceSetup` `:442` | none | **Real** — live HydraDB `/connector-catalog`, no hardcoded list | LOCAL-ONLY | D1 + HydraDB key. Note: **writes (UPSERT) inside a GET** at `:65` |
| **Database list / create** | Yes | `app/api/databases/route.ts` | `:442` | none | Real; `status:"provisioning"` at `:43` is a fixture literal | LOCAL-ONLY | D1 |
| **Connector create** | Yes | `app/api/connectors/route.ts:59-108` | `:438` | none | Real — refuses without upstream id (`:84-89`) | LOCAL-ONLY | D1 |
| **Resource discovery** | Yes | `app/api/connectors/[id]/discover/route.ts` | `:386` | none | Real | LOCAL-ONLY | D1 |
| **Sync** | Yes | `app/api/connectors/[id]/sync/route.ts` | `:389` | none | Real HydraDB call | LOCAL-ONLY | D1 |
| **Connection verification / "proof"** | "Prove every read" | `verify/route.ts:83,110` | `ProofModal` `:457` | none | **Mixed** — gating is honest (`:83` fail-closed, real record count). Hashes are real SHA-256 over real cursors. But `canary_query_hash` (`:111`) hashes the app's own template string — cosmetic. **No signature anywhere in the repo.** | LOCAL-ONLY | D1 |
| **Queue generation / ranking** | "Deterministic policy" | `lib/server/queue.ts:274-385` | `:170` | `ranking.test.ts` (4) | Real pipeline; weights are declared-policy constants (`queue.ts:151-169`) | LOCAL-ONLY | D1 |
| **Task confidence %** | Shown as measurement | `queue.ts:143-146` | `:312`, `:484` | none | **FABRICATED** — invented arithmetic, no calibration. Floor `0.38` means confidence can never display below 38%; `Math.min(0.96,…)` cap is dead (max reachable 0.86) | LIVE-as-shown | — |
| **Priority score `/100`** | Yes | `packages/ranking/src/index.ts:32-36` | `:309` | `ranking.test.ts` | Fixture-policy. `authorityReliability:5` is constant for every item ever; max reachable is 93, not 100 | LOCAL-ONLY | — |
| **Ask / evidence retrieval** | "not another chatbot" | `app/api/ask/route.ts:47` | `:341` | none | Retrieval Real; the "answer" (`:99-101`) is one of two **fixed strings** — honestly framed, no synthesis claimed | LOCAL-ONLY | D1 |
| **Query trace validation flags** | `unsupportedClaimsPrevented: true` | `app/api/query/route.ts:132-136` | trace drawer `:356` | none | **FABRICATED** — sole occurrence in repo, unconditional literal, no claim-verification logic exists. (`promptInjectionScreened` *is* backed by `:59`) | THEATRE | — |
| **MCP server + token issuance** | Yes | `packages/mcp/src/server.ts`, `app/mcp/route.ts:43-71` | `AgentScreen:471,476` | `mcp.test.ts` (2) | Real — hashed tokens, constant-time compare | LOCAL-ONLY | D1 |
| **Prompt-injection screening** | Yes | `packages/security/src/index.ts` | — | `security.test.ts` (13) | Real | LIVE | — |
| **Credential encryption** | Yes | `lib/server/crypto.ts:22-32` | — | `security.test.ts` | Real AES-GCM, random IV, SHA-256 KDF | LIVE | — |
| **Audit events** | "audit history" | `store.ts` `audit()`, ~12 call sites | not surfaced | none | Real writes, **no UI reader** | LOCAL-ONLY | no view exists |
| **Document / PDF upload** | implied by `FILES` R2 binding + `scripts/generate-large-pdf.mjs` | — | — | none | — | **ABSENT** — `formData`/`multipart`/`File`/`type="file"` = **0 matches** across `app lib packages worker cli db` | not built |
| **Evaluation lab** | Yes (MCP tool) | `server.ts:408-433` writes `eval_runs` | none | `eval-fixtures.test.ts` (33) | **THEATRE** — 1 writer, **0 readers**; returns `{status:"queued"}` for a queue nothing dequeues | THEATRE | no processor |
| **Memory** | Yes (MCP tool) | queries `memories` | none | none | **THEATRE** — table has **0 writers**, absent from `ensureCoreSchema` | THEATRE | no writer, no table |
| **Skills runtime** | 10 skills shipped in `skills/` | — | none | none | **ABSENT** — 40 files (SKILL.md + workflow.md + invocation.json + cases.json × 10 dirs), 152 lines total. **0 matches** for any loader. `skills` table has 0 writers | ABSENT | nothing loads them |
| **Change ledger** | — | — | — | none | **ABSENT** — `ledger` = 0 matches | ABSENT | — |
| **Counterfactual** | Yes | `packages/ranking/src/index.ts:75` `export function counterfactual` | none | none | **DEAD** — exported, **0 callers** outside its own definition. `retrieval` classifies the query category but nothing acts on it | DEAD | not wired |
| **Decision replay** | — | — | — | none | **ABSENT** — `replay` = 0 matches | ABSENT | — |
| **Action proposals / Linear writes** | "Provider writes remain proposals" (`:480`) | — | copy only | none | **ABSENT** — `action_proposals`/`proposeAction`/`linear` = **0 matches**. `packet.permissions.write` is hardcoded `[]` (`queue.ts:328`) | ABSENT | — |
| **Execution leases** | — | `db/schema.ts:393` `executionPacketLeases` | — | none | **ABSENT in code** — schema table only, no runtime reference | ABSENT | — |
| **Entity resolution / timeline** | Yes (MCP tools) | `server.ts:360,385` | none | none | **THEATRE** — `canonical_entities`, `entity_aliases` have 0 writers | THEATRE | no writer |
| **Commitments / conflicts detection** | Yes (MCP tools) | `server.ts:340-342` | none | none | **THEATRE** — 0 writers; always `{items: []}` | THEATRE | no writer |
| **Health: live** | Yes | `health/live/route.ts:2-6` | — | none | Fixture literal, **unauthenticated** | LIVE | — |
| **Health: dependencies** | Yes | `health/dependencies/route.ts:8-12` | — | none | **FABRICATED + unauthenticated** — `configuredPerWorkspace: true`, `baseUrl:"https://api.hydradb.com"`, `contractVersion:"2"` are all unconditional literals; nothing is probed | THEATRE | — |
| **Health: ready** | Yes | `health/ready/route.ts:8-14` | — | none | Real binding check | LIVE (returns 503) | requires **both** `DB` **and** `FILES` |
| **Drizzle ORM layer** | dependency in `package.json:35` | `db/schema.ts` (44 tables), `db/index.ts:5` `getDb()` | — | none | **DEAD** — `getDb()` has 0 callers; **0 imports** of `db/schema` or `db/index` anywhere. All 36 real persistence sites use hand-written D1 SQL | DEAD | orphaned |

---

## 2. The five things most worth knowing

1. **The entire product is gated off in production.** `QueueProofApp.tsx:179` returns `<SecureGateway />` whenever `storageAvailable === false`. Live `GET /api/workspace` returns exactly that. So 37 of the 44 interactive controls never render. The one control that does (`:243`) links to a hardcoded `chatgpt.site` URL that returns **401**.

2. **`storageAvailable` can never be `true`.** Repo-wide it has three occurrences; the only server-side one is the hardcoded literal `false` at `workspace/route.ts:20`. The other two success paths **omit the `platform` key entirely** — the app unblocks by the field *disappearing*, not by becoming true.

3. **Nine MCP tools query tables with zero writers**, and those tables aren't in `ensureCoreSchema()`'s 20-table runtime DDL. An agent calling `queueproof_detect_conflicts` gets `{"items": []}` and concludes *no conflicts exist* — a substantive false statement about the user's data. `BUILD_STATUS.md:24-27` claims memory/skills/eval-lab are "hidden rather than exposed as non-functional product theatre" — they are hidden from the **web nav** but fully exposed over **MCP**.

4. **Two invented numbers are rendered as measurements**: task confidence (`queue.ts:143-146` → displayed as `%` at `:312`, `:484`) and `unsupportedClaimsPrevented: true` (`query/route.ts:134`, sole occurrence in the repo, no backing logic).

5. **The Drizzle layer is decorative.** 44 tables in `db/schema.ts` and a 569-line migration, with **zero imports** anywhere in runtime code. The real schema is 20 hand-written `CREATE TABLE IF NOT EXISTS` statements in `store.ts:5-155`, with no indexes (vs 19 in the migration). `__drizzle_migrations` is absent from the local D1 file — the migration has **never been applied**.

---

## 2b. Fairness correction — the documentation is mostly honest

An audit looking for overclaiming should report when it does not find it. `README.md` and `BUILD_STATUS.md` are substantially more candid than the code's runtime behaviour:

- `README.md:20` scopes the entire capability list under the heading **"Implemented and verified *locally*"** — not "in production".
- `README.md:41-42` distinguishes the **"Durable authenticated app"** (`chatgpt.site`) from the **"Public launch surface"** (`queueproof.vercel.app`). It does not claim the Vercel URL is the product.
- `BUILD_STATUS.md:18-20` — "**Honest external acceptance gate**": states plainly that with no HydraDB key supplied, "live provider sync, cross-source queue quality, live Ask quality, and a hosted MCP packet-parity call **cannot be truthfully certified yet**."
- `BUILD_STATUS.md:22-27` — "**Deliberately not presented as working**" explicitly names Memory, learning, skill-registry, evaluation-lab, plugin-runtime, and **document upload / large-PDF ingestion**. My independent greps confirm all six are genuinely absent, exactly as stated.
- `README.md:33` claims "67 automated tests" — **verified true**, I executed them.

So the honest gap list is narrower than the feature table alone implies. The real discrepancies are these four:

1. **`BUILD_STATUS.md:29` is contradicted by the MCP surface.** It says the incomplete areas "are hidden from the principal navigation rather than exposed as non-functional product theatre." They are hidden from the **web nav**, but `packages/mcp/src/server.ts` exposes nine tools over MCP that query those very tables — returning `{items: []}` as if it were an answer. The stated policy is violated on the agent-facing channel.
2. **Fabricated confidence percentage** (`queue.ts:143-146` → `:312`, `:484`) — no doc discloses that this number is invented rather than measured.
3. **`unsupportedClaimsPrevented: true`** (`query/route.ts:134`) — an unconditional literal in a block labelled `validation`.
4. **The public launch surface is a dead end.** README calls it a launch surface, which is fair; but its single call-to-action (`QueueProofApp.tsx:243`) points at a URL that returns **401**, so no visitor can reach the "durable authenticated app" it advertises.

---

## 3. Security findings (surfaced during route analysis)

| Severity | Finding | Evidence |
|---|---|---|
| **CRITICAL** | Identity header trusted verbatim; **no `middleware.ts` exists** to strip it. Any client reaching the origin directly can impersonate any user and reach every authenticated write. | `lib/server/identity.ts:13,25` |
| **HIGH** | Host-header auth bypass via prefix match — `Host: localhost.attacker.example` yields an authenticated `user:local-development` actor with no credentials. Ships with `docker-compose.yml` for self-hosting. | `lib/server/identity.ts:28-32` |
| **MEDIUM** | `ensureCoreSchema()` (CREATE TABLE DDL) runs when *any* bearer token is presented, before validation. | `app/mcp/route.ts:41-42` |
| **MEDIUM** | Unauthenticated route publishes fabricated dependency health. | `app/api/health/dependencies/route.ts:8-12` |
| **LOW** | Evidence links rendered with no URL-scheme validation (`javascript:` / `data:` from upstream data are not filtered). | `QueueProofApp.tsx:363` |
| **LOW** | Audit event written with `outcome:"success"` before returning `revoked:false` on a zero-row update. | `app/api/mcp-tokens/route.ts:82-84` |

---

## 4. Status of the in-flight (uncommitted) storage fix

A concurrent session added `lib/server/d1-compat.ts` — a hand-written D1-compatible facade over **Turso/libSQL** (HTTP `/v2/pipeline`) or `node:sqlite`. `runtime-vercel.ts` now proxies `DB` through it.

Assessment:
- It **correctly targets the real blocker** and is a sound approach.
- It is **not committed** (`git show HEAD:lib/server/runtime-vercel.ts` is still the one-line `process.env` export) and **not deployed** — live production still returns `storageAvailable:false`.
- It is **inert without credentials**: `d1-compat.ts:361-362,401-407` requires `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`, else `backend:"none", database:null`. Those variables appear **nowhere** — not in `.env.example`, not in any doc or script.
- `storageAvailable` is still the hardcoded `false` literal, so `workspace/route.ts:20` still needs editing for the gate to lift.
- **`/api/health/ready` will still 503 even after Turso is configured**, because `:8` also requires `FILES` (R2), and the new proxy special-cases only `DB` (`runtime-vercel.ts:18`).

---

## 5. Honest coverage note

- Test suite was **executed**, not inferred: 67/67 passing. But coverage is narrow — every test targets pure functions (`ranking`, `retrieval`, `contracts`, `security`, `cli-config`, eval fixtures). **Zero tests exercise any API route, any D1 write, the queue pipeline end-to-end, or any React component.**
- Live-production behaviour was verified by direct HTTP against `queueproof.vercel.app` (`/`, `/api/workspace`, `/api/queue`, `/api/health/ready`) and against the gateway's target URL.
- Not read in full: `lib/server/hydradb-shapes.ts`, `hydradb-account.ts`, `api.ts`, `db/schema.ts` (enumerated, not line-read), `worker/index.ts`, and the 40 `skills/` files (sampled).
- The working tree was mutating during the audit; all conclusions are pinned to the committed/deployed artifact unless stated otherwise.
