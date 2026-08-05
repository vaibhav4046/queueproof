# QueueProof — Repository Map

> [!WARNING]
> **SUPERSEDED — HISTORICAL FORENSIC SNAPSHOT.** This inventory describes the 31 July 2026
> repository and is retained for provenance. File counts, route status, line numbers, and
> working-tree claims are not current release evidence. Use
> [`../RELEASE_EVIDENCE.md`](../RELEASE_EVIDENCE.md) and
> [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).

Read-only forensic audit. Repo root: `D:\Codex d;\queueproof`. No source file was modified.
Excluded from counts: `node_modules`, `.next`, `dist`, `build`, `pnpm-lock.yaml`.

---

## 1. Inventory by area

| Area | Files | Lines | Tracked in git | Notes |
|---|---:|---:|---:|---|
| `app/` | 27 | 2,291 | 21 | Next.js App Router. 1 page, 1 client component, 22 route handlers. 6 API routes untracked. |
| `lib/` | 10 | 887 | 9 | All under `lib/server/`. Runtime bindings, store, queue, crypto, identity. |
| `db/` | 2 | 600 | 2 | `schema.ts` (586 lines) — Drizzle schema. |
| `worker/` | 1 | 47 | 1 | Cloudflare Worker entry. |
| `cli/` | 2 | 132 | 2 | `queueproof.mjs` bin entry. |
| `packages/` | 7 | 1,155 | 7 | `mcp` (579), `hydradb` (164), `contracts` (119), `connectors` (95), `ranking` (80), `retrieval` (69), `security` (49). |
| `scripts/` | 7 | 53 | 7 | ~7.5 lines/file average. |
| `tests/` | 9 | 269 | 9 | ~30 lines/file average. |
| `evals/` | 1 | 34 | 1 | Single file. |
| `skills/` | 40 | 152 | 40 | **~3.8 lines per file.** Largest tracked dir by file count, smallest by content. |
| `submission/` | 9 | 166 | 9 | Hackathon submission material. |
| `docs/` | 4 | 47 | 4 | ~12 lines/file. |
| `drizzle/` | 3 | 4,264 | 3 | Generated migration artifacts. |
| `types/` | 1 | 46 | 1 | `cloudflare.d.ts`. |
| `examples/` | 0 | 0 | 0 | **Empty directory.** |
| `public/` | 4 | — | 4 | `og.png` (1.9 MB), `queueproof-sentinel.png` (2.7 MB), `.webp` (240 KB), `favicon.svg`. |
| `build/` | 1 | 45 | 0 | Vite plugin, untracked. |
| `dist/` | 31 | 57,324 | 0 | Build output, gitignored. Not source. |

**Total tracked source: ~130 files.** The `dist/` 57k lines are compiled output and must not be counted as implementation.

### Root files
`ARCHITECTURE.md`, `BUILD_STATUS.md`, `CONTRIBUTING.md`, `DEPLOYMENT.md`, `README.md`, `SECURITY.md`, `TROUBLESHOOTING.md`, `Makefile`, `docker-compose.yml`, `drizzle.config.ts`, `next.config.ts`, `vercel.json`, `vite.config.ts`, `vitest.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `tsconfig.json`, `.env.example`.

### Git state
5 commits total. Most recent: `55059e7 Rebuild QueueProof as an evidence-first agent`.
Six API routes are **untracked** (never committed): `app/api/ask/`, `app/api/queue/`, `app/api/queue/[id]/`, `app/api/databases/`, `app/api/mcp-tokens/`, `app/api/connectors/[id]/proof/`.

---

## 2. The storage layer — verified verdict

### What it is
The durable store is **Cloudflare D1**, accessed through a Workers-runtime binding.

- `lib/server/runtime.ts:4` — `DB?: D1Database;`
- `lib/server/runtime.ts:20-24` — `requireDb()` throws `"QueueProof database binding is unavailable."` when absent.
- `lib/server/runtime-provider.ts:1` — `import { env } from "cloudflare:workers";`
- `dist/server/wrangler.json` — binds `DB` → D1 `site-creator-d1`, and `FILES` → R2 `site-creator-r2`.
- `.openai/hosting.json` — `{"project_id":"appgprj_6a6c6c0dff10819189abd21f0768d8e0","d1":"DB","r2":"FILES"}`

The app was built for **OpenAI's ChatGPT Apps hosting platform**, which supplies Cloudflare-style D1/R2 bindings. That is the only environment where its storage contract is satisfiable.

### Two red flags in the binding config
1. `dist/server/wrangler.json` declares `"database_id":"00000000-0000-4000-8000-000000000000"` — an **all-zeros placeholder UUID**, not a provisioned D1 database.
2. The resource names are `site-creator-d1` / `site-creator-r2` — names belonging to a **different project**, indicating the deployment config was scaffolded from another template and never specialised.

### Why it cannot work on Vercel
`next.config.ts:8-13` rewrites the binding source at build time:

```ts
config.resolve.alias[path.resolve(projectRoot, "lib/server/runtime-provider.ts")] =
  path.resolve(projectRoot, "lib/server/runtime-vercel.ts");
```

`vercel.json` forces that webpack path: `"buildCommand": "node ./node_modules/next/dist/bin/next build --webpack"`.

The substituted module is one line — `lib/server/runtime-vercel.ts:1`:

```ts
export const runtimeBindings = process.env as Record<string, unknown>;
```

So on Vercel, `runtimeEnv().DB` resolves to `process.env.DB`. That is a **string environment variable slot, not a `D1Database` object**. It is undefined by default; and even if an operator set `DB=<anything>`, the value would be a string, so the first call to `db.prepare(...)` or `db.batch(...)` (`app/api/workspace/route.ts:74-86`) would throw `db.prepare is not a function`.

**There is no code path that writes durably when deployed on Vercel.** The Vercel adapter is a type-cast, not an implementation.

Local development works only under Wrangler/Miniflare, which provisions a real local D1:
`.wrangler/state/v3/d1/miniflare-D1DatabaseObject/faaf2b04...sqlite`

---

## 3. `platform.storageAvailable` — exactly what it means

Computed in one place, `app/api/workspace/route.ts:14-22`:

```ts
if (!runtimeEnv().DB) {
  return noStoreJson({
    ok: true,
    actor: { displayName: "Deployment preview", localDevelopment: false },
    workspace: null,
    hydradb: { configured: false },
    platform: { runtime: "vercel", storageAvailable: false },
  });
}
```

- **What it literally checks:** truthiness of `runtimeEnv().DB`. Nothing else. It is not a health check, not a connectivity probe.
- **Note:** `runtime: "vercel"` is a **hardcoded string literal**, not runtime detection. Any environment missing the `DB` binding is labelled "vercel".
- **Why it is false on Vercel:** `runtimeBindings` is `process.env` (see §2), and `process.env.DB` is undefined.
- **What would make it true:** only a real `D1Database` object on the binding — i.e. running on Cloudflare Workers or ChatGPT Apps hosting with a provisioned D1. **No Vercel configuration can produce this**, because D1 bindings are injected by the Workers runtime, not by environment variables.

### The consequence — this gates the entire product
`app/QueueProofApp.tsx:179`:

```tsx
if (workspace?.platform?.storageAvailable === false) return <SecureGateway />;
```

This check sits **above** the workspace check and above all four tabs. When it fires, the whole application is replaced by a single static screen.

### Verified against live production

| Live request | Result |
|---|---|
| `GET https://queueproof.vercel.app/api/workspace` | `200` — `{"ok":true,"actor":{"displayName":"Deployment preview","localDevelopment":false},"workspace":null,"hydradb":{"configured":false},"platform":{"runtime":"vercel","storageAvailable":false}}` |
| `GET https://queueproof.vercel.app/api/health/ready` | `503 Service Unavailable` |
| `GET https://queueproof.vercel.app/api/queue` | `401 Unauthorized` |
| `GET https://queueproof.vercel.app` (SSR shell) | Boot screen: `"Establishing workspace trust boundary…"` (`QueueProofApp.tsx:230`) |
| `GET https://queueproof-control-plane.vaibhav09908.chatgpt.site` (the gateway's only link) | **`401 Unauthorized`** |

The live deployment returns exactly the `storageAvailable: false` branch. The public site is therefore permanently the gateway screen, and its single call-to-action leads to a 401.

---

## 4. UI control inventory — `app/QueueProofApp.tsx` (489 lines)

489 lines, 13 components, one `"use client"` file. Every interactive control:

### Root `QueueProofApp` (114-227)
| # | Line | Control | Class | Target |
|---:|---|---|---|---|
| 1 | 186 | Brand button | (c) panel | `setTab("command")` |
| 2-5 | 191-195 | Nav: Command / Ask / Sources / Agent | (c) panel | `setTab(id)` |
| 6 | 208 | Toast dismiss | (d) local UI only | clears error/notice state |

### `SecureGateway` (233-248) — **the only screen reachable in production**
| # | Line | Control | Class | Target |
|---:|---|---|---|---|
| 7 | 243 | "Open QueueProof" | (b) navigates off-site | hardcoded `FULL_APP_URL` (`:12`) → **401** |

Line 244 renders trust badges reading `Durable D1` — displayed precisely because D1 is unavailable.

### `WorkspaceSetup` (250-273)
| # | Line | Control | Class | Target |
|---:|---|---|---|---|
| 8 | 267 | Workspace name input | form field | — |
| 9 | 269 | "Create workspace" | (a) API | `POST /api/workspace` (`:256`) |

### `CommandScreen` (275-330)
| # | Line | Control | Class | Target |
|---:|---|---|---|---|
| 10 | 289 | Primary button (dual-mode) | (a) API **or** (c) panel | `verified.length` ? `POST /api/queue` (`:170`) : `setTab("sources")` |
| 11 | 306 | Hero packet card | (c) opens drawer | `onSelectPacket` |
| 12 | 318 | Queue row buttons (mapped) | (c) opens drawer | `onSelectPacket` |

Line 327 `method-strip` is static text, non-interactive. It claims `Web/API/MCP packet parity` and falls back to a hardcoded policy version `"1.0"`.

### `AskScreen` (332-360)
| # | Line | Control | Class | Target |
|---:|---|---|---|---|
| 13-14 | 349 | "Fast" / "Thinking" mode toggles | (e→a) param | sets `mode`, sent in request body |
| 15 | 350 | Question textarea | form field | max 4000 chars |
| 16 | 351 | "Retrieve evidence" | (a) API **or** (d) short-circuit | `POST /api/ask` (`:341`) — but `:339` returns early to `onOpenSources()` when `verifiedCount === 0`, firing no request |
| 17 | 356 | Retrieval trace `<details>` | (c) expands | renders `JSON.stringify(trace)` |

### `EvidenceCard` (362-364)
| # | Line | Control | Class | Target |
|---:|---|---|---|---|
| 18 | 363 | "Open source" link | (b) navigates | `evidence.url`, rendered only when present. **No URL scheme validation** — `javascript:` / `data:` hrefs from upstream data are not filtered. |

### `SourcesScreen` (366-412)
| # | Line | Control | Class | Target |
|---:|---|---|---|---|
| 19 | 404 | "Add source" | (c) opens modal | conditional on `hydradb.configured` |
| 20 | 405 | HydraDB API key input | form field (password) | — |
| 21 | 405 | "Verify and encrypt" | (a) API | `POST /api/hydradb/configure` (`:377`) |
| 22 | 407 | Per-connector action button | (a) API — **polymorphic, 4 endpoints** | see below |
| 23 | 407 | "Add first source" (empty state) | (c) opens modal | — |

Control 22 dispatches on `connector.state` (`:385-397`):
- `connector_created` \| `resources_discovered` → `POST /api/connectors/{id}/discover`
- `resources_selected` → `POST /api/connectors/{id}/sync`
- `data_verified` → `GET /api/connectors/{id}/proof`
- anything else → `POST /api/connectors/{id}/verify`

### `SourceSetup` modal (414-443)
| # | Line | Control | Class | Target |
|---:|---|---|---|---|
| 24 | 442 | Close X | (c) | — |
| 25 | 442 | Provider `<select>` | form | options from `GET /api/providers` (`:426`) |
| 26 | 442 | Database `<select>` | form | options from `GET /api/databases` (`:426`) |
| 27 | 442 | Collection input | form | — |
| 28 | 442 | "Create" database | (a) API | `POST /api/databases` (`:432`) — **rendered only when `!databases.length`** |
| 29 | 442 | Account scope input | form | — |
| 30 | 442 | Dynamic credential fields | form | rendered from provider contract |
| 31 | 442 | "Create connector" | (a) API | `POST /api/connectors` (`:438`) |

### `ProofModal` (445-458)
| # | Line | Control | Class | Target |
|---:|---|---|---|---|
| 32 | 457 | Close X | (c) | — |
| 33 | 457 | Resource checkboxes | form | — |
| 34 | 457 | "Save scope and start sync" | (a) API | `POST /api/connectors/{id}/configure` (`:453`) |
| 35 | 457 | "Raw proof record" `<details>` | (c) expands | — |

### `AgentScreen` (460-481)
| # | Line | Control | Class | Target |
|---:|---|---|---|---|
| 36 | 480 | Client `<select>` | form | codex/claude/kimi/kilo/generic |
| 37 | 480 | "Allow proposal + sync tools" checkbox | form | widens requested scopes |
| 38 | 480 | "Generate 30-day token" | (a) API | `POST /api/mcp-tokens` (`:471`) |
| 39 | 480 | "Copy token" | (d) clipboard only | `navigator.clipboard` |
| 40 | 480 | "Copy" config | (d) clipboard only | `navigator.clipboard` |
| 41 | 480 | "Revoke" (per token) | (a) API | `DELETE /api/mcp-tokens` (`:476`) |

### `PacketDrawer` (483-485)
| # | Line | Control | Class | Target |
|---:|---|---|---|---|
| 42 | 484 | Close X | (c) | — |
| 43 | 484 | Backdrop click-out | (c) | — |
| 44 | 484 | "Copy canonical JSON" | (d) clipboard only | `navigator.clipboard` |

### Summary of control classification
- **(a) Real API call:** 13 controls across 12 distinct endpoints.
- **(b) Navigates:** 2 (one hardcoded off-site to a 401; one data-driven, unvalidated scheme).
- **(c) Opens panel / tab / drawer:** 16.
- **(d) Inert (local state or clipboard only):** 4.
- **(e) Disabled:** none permanently disabled; several are `disabled` transiently during in-flight requests, and several are conditionally rendered.

**In production, controls 8-44 are unreachable.** The `storageAvailable === false` gate at `:179` returns before any of them render. The live product surface is control 7 alone.

---

## 5. Deployment configuration

- `vercel.json` — framework `nextjs`, forced webpack build. No env, no regions, no bindings.
- `next.config.ts` — sole purpose is the runtime-provider alias swap (§2).
- `.openai/hosting.json` — ChatGPT Apps project binding D1 + R2.
- `dist/server/wrangler.json` — generated Worker config with placeholder D1 id.
- `.wrangler/state/…` — local Miniflare D1/R2 state, proving the app has only ever been exercised locally under Wrangler.
- `.env.example` — 8 variables. Includes `QUEUEPROOF_TEST_MODE=false` with the comment `"Never enable fixture mode in a production deployment."`, confirming a fixture mode exists in the codebase.

---

*Companion document: `FEATURE_TRUTH_TABLE.md`.*
