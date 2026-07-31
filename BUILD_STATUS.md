# Build status — 2026-07-31 (recovery session)

## Current gate

**Gate 0 (Truth) — complete.** **Gate 1 (Canonical deployment) — code complete, blocked on one
credential for the hosted database.** Gates 2+ blocked on external authorisation
(see `AUTH_REQUIRED.md`).

---

## What this session verified, with evidence

### Baseline reproduced (prior report was accurate)

`tsc --noEmit` exit 0. `vitest run` → 67/67 passing before changes, **84/84 after**
(+17 new SSRF tests). Production build exit 0, 24 routes.

Caveat the prior report omitted: the suite runs in ~130 ms and **no test exercises any
API route, any database write, or any MCP tool handler**. 33 of the original 67 are
single-line fixture classifications.

### The public deployment was a billboard, not a product

Verified live, not inferred:

- `GET https://queueproof.vercel.app/api/workspace` → `{"platform":{"runtime":"vercel","storageAvailable":false}}`
- `GET /api/mcp` → 503
- The page **does** hydrate; it renders a splash reading "This public edge is the launch
  surface", linking to `queueproof-control-plane.vaibhav09908.chatgpt.site`, which returns
  **401**. That host is a Codex sandbox, not infrastructure the project controls.

Root cause: `lib/server/runtime-vercel.ts` exported `process.env` alone, so
`runtimeEnv().DB` was always undefined and every route short-circuited to a stub;
`app/QueueProofApp.tsx:179` then fell through to the splash.

The "Establishing workspace trust boundary…" text an external fetch saw is the
server-rendered shell before hydration — so crawlers and non-JS clients saw a permanent
loading message.

### Fixed and verified: durable storage on the Vercel code path

`lib/server/d1-compat.ts` implements the exact D1 surface the codebase uses
(`prepare`/`bind`/`first`/`all`/`run`/`batch`, atomic batches) over:

- **libSQL/Turso** over the HTTP pipeline API — hosted, plain `fetch`, no new dependency
- **node:sqlite** — local/CI, built into Node, zero accounts

Verified on `next build --webpack` + `next start`:

```
/api/health/dependencies -> storage {configured:true, backend:"sqlite"}
POST /api/workspace      -> ws_55720745-… created
GET  /api/workspace      -> returns that workspace (persisted)
POST /api/workspace      -> "A workspace already exists for this account."
```

The UI now renders the real product shell (Command / Ask / Sources / Agent) with an
honest empty state, instead of the splash.

Note: `node:sqlite` is loaded via `process.getBuiltinModule`. An earlier `createRequire`
approach was silently erased to `void 0` by webpack, which disabled storage with no error —
`/api/health/dependencies` now reports the storage backend and failure detail so this class
of misconfiguration cannot fail silently again.

### Fixed and verified: authentication bypass (was CRITICAL)

`lib/server/identity.ts` previously granted a full workspace identity to anyone who sent
an `oai-authenticated-user-email` header, and to anyone whose `Host` header merely
*started with* `localhost` (so `localhost.attacker.example` passed). That was survivable
only while the deployment had no database — **attaching storage armed it**, so it was fixed
in the same session.

Now: signed HMAC-SHA256 session cookie (httpOnly, secure, sameSite, 12 h expiry); the
gateway header is trusted only when `QUEUEPROOF_TRUSTED_IDENTITY_PROXY=openai-sites`; local
identity requires an explicit env opt-in **and** refuses to activate when
`NODE_ENV=production`.

Measured against a production build:

| Attack | Result |
| --- | --- |
| Spoofed `oai-authenticated-user-email` | **401** |
| `Host: localhost.attacker.example` | **401** |
| `Host: localhost` reading `/api/mcp-tokens` | **401** |
| No credentials | **401** |
| Wrong access token | **401** |
| Session signature replaced with garbage | **401** |
| Payload swapped to another email, signature kept | **401** |
| Unsigned payload | **401** |
| Correctly signed but expired | **401** |
| Valid session cookie (control) | **200** |

### Fixed: SSRF blocklist

`assertSafeExternalUrl` did not block `169.254.0.0/16`, so the cloud instance-metadata
endpoint (`169.254.169.254`) was reachable from a user-supplied `baseUrl`. Added link-local,
CGNAT, IPv6 ULA/link-local, IPv4-mapped IPv6 and `.internal`. 17 tests added.

---

## Confirmed NOT working (do not claim these)

Independently verified this session:

- **Document / PDF upload: absent.** No upload route, no `formData()` construction. No
  HydraDB ingest call exists. `scripts/generate-large-pdf.mjs` is 2 lines and generates
  no PDF.
- **Linear integration: absent.** Zero Linear code; all occurrences are UI copy or regex
  stop-words. No provider-specific adapter exists for Slack, Gmail or Linear.
- **Evaluation lab: absent** (UI). `scripts/run-evals.mjs` counts an array and runs nothing.
- **Memory, skills runtime, decision replay, execution leases: absent.** Schema-only.
- **Counterfactual: real arithmetic, zero production callers.** `sensitivity_json` is
  written as `{}`, so `explain_priority`'s promised sensitivity is always empty.
- **Schema gap:** `ensureCoreSchema()` creates 20 tables; the drizzle migration declares 44
  and **nothing applies it**. 10 of 22 MCP tools query tables that are never created and
  would throw `no such table`. No test catches this because no test invokes an MCP handler.
- **Fabricated values:** `unsupportedClaimsPrevented: true` is unconditional; the
  confidence figure in `lib/server/queue.ts` is invented arithmetic with an unreachable
  ceiling; `queueproof_health` returns a hardcoded literal and cannot report unhealthy.
- **MCP tool duplication:** `search`/`ask` are the same closure;
  `find_commitments`/`find_untracked_commitments` are identical (no "untracked"
  predicate); `what_changed` is a raw SELECT with no diff; `detect_conflicts` returns
  `{items:[]}` — which actively tells an agent no conflicts exist.

Secret scan: **zero secrets** in working tree, all 5 commits of history, and build output.
The token exposed in chat is not in this repo but must still be rotated at its source.

---

## Next action

1. Provide one hosted-database credential (`AUTH_REQUIRED.md`, Blocker 1) — this alone
   converts `queueproof.vercel.app` from a splash into the running product.
2. Apply the drizzle migration at boot, or trim the MCP surface to the 20 tables that
   actually exist. Currently 10 tools are guaranteed to throw.
3. Provide a HydraDB key (Blocker 2) to start connector work.
