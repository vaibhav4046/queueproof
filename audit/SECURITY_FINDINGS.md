# QueueProof Security Audit — historical findings

> **Point-in-time audit; not current security status.** This report describes the 31 July 2026
> tree and five-commit history. It predates later session, identity, rate-limit, and deployment
> hardening, so findings may have been remediated or changed. Preserve it as before-state
> evidence; use [`../SECURITY.md`](../SECURITY.md), current tests, CI, and a fresh secret scan
> for release decisions.

**Date:** 2026-07-31
**Scope:** `D:\Codex d;\queueproof` working tree, full git history (all 5 commits, 288 objects), build output (`.next/`, `dist/`, `.vercel/`, `.wrangler/` incl. local D1/cache SQLite state, `.openai/`), `app/api/**`, `app/mcp/route.ts`, `lib/**`, `packages/**`. `node_modules` excluded per instructions.
**Method:** read-only. No fixes applied. No live requests sent to any deployed URL (all findings are static-analysis based).
**Git remote:** `sites\thttps://git.chatgpt-team.site/...` (Codex/OpenAI Sites sandbox, not GitHub) — noted throughout where relevant.

---

## Executive summary

| Severity | Count |
|---|---|
| CRITICAL | 2 |
| HIGH | 2 |
| MEDIUM | 3 |
| LOW / INFO | 3 |

**Secrets scan result: clean.** No hardcoded credential, API key, bearer token, private key, or connection string with a real value was found in the working tree, in any of the 5 commits across full git history (`git log -p --all`, `git rev-list --all --objects`), or in any build/local-config output (`.next`, `dist`, `.vercel`, `.wrangler` including binary SQLite local D1/cache state, `.openai`). All working-tree/history pattern hits were false positives (see "Secrets scan detail" below). The provider token exposed earlier in chat is **not present anywhere in this repository** — it was never committed, logged, or baked into a build. It must still be rotated at its source; that rotation cannot be verified from this repo.

**Auth/tenant-isolation verdict:**
- **Per-route tenant isolation (once identity is established): GOOD.** Every one of the 21 `app/api/**/route.ts` handlers that touches workspace data binds `WHERE workspace_id = ?` using a server-resolved workspace id, never a client-supplied one. The MCP tool layer (`packages/mcp/src/server.ts`) is equally disciplined — `workspaceId` is fixed at handler-construction time from the authenticated token and every SQL statement is scoped by it.
- **Identity establishment itself: BROKEN.** The single actor-identity function used by nearly every route (`lib/server/identity.ts`) trusts a client-suppliable HTTP header with no signature/HMAC verification, and has a separate `Host`-header-based bypass. This is the #1 finding below.
- **Remote MCP endpoint (`/mcp`, `app/mcp/route.ts`): correctly fail-closed, bearer-token hashed at rest, constant-time compared, workspace bound by the token record itself (not client input).** Not anonymously callable — a 401 with `WWW-Authenticate: Bearer` is returned for any request without a valid token.

---

## CRITICAL

### C1 — Identity is established from a client-suppliable, unverified HTTP header

**Files:** `lib/server/identity.ts:11-38`, `app/chatgpt-auth.ts:19-36`

```
lib/server/identity.ts:13   const email = requestHeaders.get("oai-authenticated-user-email");
lib/server/identity.ts:14   if (email) { ... return { id: `user:${email.toLowerCase()}`, ... } }
```

`getRequestActor()` treats the presence of an `oai-authenticated-user-email` request header as proof of identity. There is no signature, no HMAC, no shared secret, no mTLS check — any caller who can set this header is treated as that user. `requireRequestActor()` (called first in `app/api/hydradb/configure`, `app/api/connectors`, `app/api/connectors/[id]/*`, `app/api/mcp-tokens`, `app/api/providers`, `app/api/workspace`, `app/api/queue`, `app/api/queue/[id]`, `app/api/ask`, `app/api/query`, `app/api/databases`, `app/api/health/connectors` — every state-changing and most read routes) is the sole gate.

This trust model is correct **only** if the app is reached exclusively through OpenAI's Sites/Apps-SDK gateway, which is documented to inject these headers (`app/chatgpt-auth.ts` implements the matching `/signin-with-chatgpt` flow) and is presumed to strip client-supplied copies before forwarding. That assumption cannot be verified from this repo, and the repo itself ships a second deployment target that breaks it:

- `DEPLOYMENT.md:31-35` documents a **Vercel** deployment (`vercel.json`, `.vercel/project.json`, commit `901125d "Add verified Vercel deployment"`) that serves the identical Next.js app directly on the public internet with no OpenAI gateway in front, and nothing in `next.config.ts`'s webpack alias swap (which only replaces `runtime-provider.ts`) touches `lib/server/identity.ts`.
- `workspaceForUser()` (`lib/server/store.ts:200-211`) looks a workspace up by **exact string equality** on the spoofed actor id — no additional secret.
- `POST /api/workspace` (`app/api/workspace/route.ts:54-100`) creates a brand-new workspace bound to `actor.id` on first contact with **no email verification step**.

**Impact if reachable directly (e.g., the documented Vercel target once a database is attached, or if the Cloudflare/OpenAI Sites deployment is ever reachable outside the gateway):** an unauthenticated caller who sends `oai-authenticated-user-email: victim@example.com` gets full owner-equivalent access to that email's workspace — list/create/revoke MCP tokens (`app/api/mcp-tokens/route.ts`), overwrite the stored HydraDB credential via the `ON CONFLICT(workspace_id) DO UPDATE` upsert (`app/api/hydradb/configure/route.ts:43-52`), read/create connectors, and read Ask/Query evidence. If the email has never been used, the attacker can pre-create ("squat") the workspace and silently inherit access when the real user later signs in through the legitimate gateway.

**Current mitigating factor:** `app/api/workspace/route.ts:14,56` and the DB-touching path inside `requireWorkspaceForUser` → `workspaceForUser` → `requireDb()` all throw/503 when `runtime.DB` is absent. The DEPLOYMENT.md-documented Vercel target currently has no D1-compatible binding wired up (`.env.example` has no DB connection var), so exploitation is gated behind that absence today. This is fragile, not a fix — it depends entirely on nobody wiring a database into the Vercel project, and does not address whether the primary Cloudflare/OpenAI Sites target is actually gateway-only.

**Recommendation:** Verify and enforce the trust boundary in code, not by infrastructure omission — e.g., require and validate a platform-issued signed assertion (OpenAI Sites should provide one) instead of a bare header, or explicitly refuse to serve `identity.ts`'s header path unless a shared-secret/HMAC check passes. At minimum, gate the Vercel build so it cannot resolve real workspaces at all (fail closed by design, not by missing env var).

### C2 — `Host`-header localhost bypass grants an authenticated identity with no credentials at all

**File:** `lib/server/identity.ts:28-38`

```
lib/server/identity.ts:28   const allowLocal =
lib/server/identity.ts:29     runtimeEnv().QUEUEPROOF_ALLOW_LOCAL_IDENTITY === "true" ||
lib/server/identity.ts:30     requestHeaders.get("host")?.startsWith("localhost") ||
lib/server/identity.ts:31     requestHeaders.get("host")?.startsWith("127.0.0.1");
lib/server/identity.ts:32   if (!allowLocal) return null;
lib/server/identity.ts:33   return { id: "user:local-development", ... };
```

Independent of C1, this branch grants the fixed `user:local-development` identity to **any** request whose `Host` header starts with `localhost` or `127.0.0.1` — no target email needs to be known or guessed. The HTTP `Host` header is application-layer text the client controls; many reverse-proxy/edge configurations forward it to the origin unchanged even though TLS SNI/routing used a different (real) domain to reach that origin. This code path has no business existing in a build that also serves production traffic (the same `identity.ts` is used for both the Cloudflare/OpenAI Sites and Vercel targets — there is no build-time flag stripping this branch for production).

**Recommendation:** Remove this branch from any production/shared build entirely, or gate it strictly behind a build-time constant that cannot be set in production, never a runtime request header.

---

## HIGH

### H1 — SSRF protection is an incomplete IP blocklist, not an allowlist

**File:** `packages/security/src/index.ts:26-42` (`assertSafeExternalUrl`), consumed by `packages/hydradb/src/client.ts:26` and used on the user-supplied `baseUrl` in `app/api/hydradb/configure/route.ts:17-18`.

The blocklist covers `localhost`, `127.0.0.1`, `::1`, `*.local`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` — but **not** link-local `169.254.0.0/16` (the AWS/GCP/Azure/DO cloud-metadata range, `169.254.169.254`), not IPv6 unique-local (`fc00::/7`), and performs no re-resolution/DNS-rebinding check between validation time and `fetch()` time. The enforced `https:`-only protocol requirement (metadata services are typically plain-HTTP) meaningfully narrows real-world exploitability of the metadata-endpoint case specifically, but the pattern is fragile in general — hostname-blocklist SSRF guards are a known-weak control class. `tests/security.test.ts:18-21` only asserts the ranges already in the blocklist, so this gap is untested too.

Exploitation of this specific gap requires reaching `hydradb/configure`, which itself sits behind the C1/C2 identity gate — so today its practical severity is coupled to those findings, but it should be fixed independently since it also applies to any legitimately-authenticated-but-malicious user.

**Recommendation:** Resolve the hostname to an IP before connecting and check the resolved IP (not just the hostname string) against a complete private/link-local/loopback range list, or switch to an explicit allowlist of expected HydraDB hosts.

### H2 — Dependency vulnerabilities (`pnpm audit --audit-level=high`): 1 critical, 7 high, 5 moderate, 3 low

Full output saved to audit run; key items:

| Severity | Package | Issue | Path | Production-facing? |
|---|---|---|---|---|
| critical | `vitest` (>=4.0.0 <4.1.0) | Vitest UI server allows arbitrary file read/execute (GHSA-5xrq-8626-4rwp) | direct devDependency | No — only if a dev runs `vitest --ui` on a reachable interface |
| high | `undici` (<7.28.0), 3 advisories | TLS bypass / DoS / cross-origin proxy reuse | `@cloudflare/vite-plugin > miniflare > undici` | No — local Workers dev emulation only |
| high | `ws` (<8.21.0) | Memory-exhaustion DoS | `@cloudflare/vite-plugin > ws` | No — dev only |
| high | `vite` (<=8.0.15) | `server.fs.deny` bypass on Windows | direct devDependency | No — dev server only |
| high | `react-server-dom-webpack` (>=19.2.0 <19.2.8) | DoS in Server Functions | direct dependency | **Yes — part of the shipped React 19 runtime** |
| high | `brace-expansion` (<=5.0.7) | DoS via unbounded expansion | `eslint > minimatch > brace-expansion` | No — lint tooling only |

Nearly all findings are dev-tooling-only exposure (miniflare/vite/eslint chains never ship to the production request path). `react-server-dom-webpack` is the one runtime-facing package and should be bumped to `>=19.2.8`. `vitest` should be bumped to `>=4.1.0` before anyone runs its UI mode, even locally.

---

## MEDIUM

### M1 — Static/env-configured MCP token is permanently full-scope with no revocation or audit trail

**File:** `app/mcp/route.ts:39-40, 59-61, 81-85`

When `QUEUEPROOF_MCP_TOKEN`/`QUEUEPROOF_MCP_WORKSPACE_ID` are set (the single-tenant fallback path, independent of the D1-backed per-client tokens issued by `app/api/mcp-tokens`), the resolved scopes are unconditionally `["queueproof:read", "queueproof:propose", "queueproof:sync"]` — full read/propose/sync, with no expiry and no way to revoke short of changing the env var and redeploying. The `audit()` call at line 81 only fires `if (runtime.DB)`, so this fallback path leaves **no audit record** of any tool call made against it. Given the task context (a provider token was exposed in chat and must be treated as compromised), if `QUEUEPROOF_MCP_TOKEN` is or was ever set to a value that was pasted into a chat session, it should be rotated now — there is no way to confirm from the repo which token was exposed.

**Recommendation:** Scope the static fallback token via its own env var (e.g., `QUEUEPROOF_MCP_SCOPES`) rather than hardcoding full access, and emit an audit/log line even without D1.

### M2 — Prompt-injection screening is a narrow keyword heuristic

**File:** `packages/security/src/index.ts:20-24` (`isPotentialPromptInjection`)

The filter matches a fixed set of English phrasings (`ignore/override/forget ... previous/system/developer instructions`, `reveal secrets/credentials/system prompt`, `execute shell/command`). It is correctly applied before retrieved evidence is surfaced (`app/api/ask/route.ts:69`, `lib/server/queue.ts:247`, `app/api/query/route.ts:59` flags but does not drop), but is trivially bypassed by rephrasing, non-English text, or indirection. This is a reasonable defense-in-depth layer, not a strong guarantee — the product's structural mitigation (retrieved content is never auto-executed; all writes require a separate human-approved proposal per `packages/mcp/src/server.ts:263-294`) is the real backstop and is well-implemented. No change required beyond documenting this limitation, which `SECURITY.md` does not currently do.

### M3 — `.openai/hosting.json` is committed to git

**File:** `.openai/hosting.json` (tracked, added in the initial commit `8220695`)

Contents are non-sensitive (`project_id`, and the `DB`/`FILES` binding names) but this is the one path under a dotfile-hosting-config family (`.openai/`, `.vercel/`, `.wrangler/`) that is **not** covered by `.gitignore` and **is** intentionally tracked. Given this repo's remote is a private Codex sandbox rather than GitHub, and given the explicit instruction to flag anything that would leak if pushed public: this file's content is fine to be public as-is, but confirm that stays true — nothing here should ever gain a real credential field without a corresponding `.gitignore` entry first.

---

## LOW / INFO

- **`.dev-server.log` / `.dev-server.err`** are correctly listed in `.gitignore` and are currently 0 bytes — no live secret leakage into logs observed. Error paths consistently pass through `redactSecrets()` (`lib/server/api.ts:11-15`, `packages/hydradb/src/client.ts:66,84`) before being returned to the client or persisted (`app/api/ask/route.ts:90` stores `redactSecrets(question)`), which is good hygiene.
- **`.gitignore` coverage confirmed adequate**: `.env*` (with `.env.example` explicitly un-ignored), `/.vercel`, `/.wrangler/`, `/dist/`, `/.next/`, `*.tsbuildinfo` are all present (`.gitignore:33-46`).
- **CORS / `dangerouslySetInnerHTML`**: no `Access-Control-Allow-Origin` headers and no `dangerouslySetInnerHTML` usage found anywhere in the codebase.

---

## Secrets scan detail (for the record)

All pattern hits investigated were false positives, confirmed by reading surrounding context:
- `sk-[A-Za-z0-9_-]{10,}` matched the English word "**risk**-classified" in `submission/judge-one-pager.md:13` (also present in git history) and Next.js's internal `sk-async-storage` module identifier throughout `.next/server/**` — neither is a secret.
- `apiKey\s*[:=]` matched minified destructuring (`apiKey=a.apiKey`) in compiled `.next` bundles — variable-name code, not a value.
- `QUEUEPROOF_MCP_TOKEN` appears once in a **client-side** bundle (`.next/static/chunks/app/page-*.js`) — traced to `app/QueueProofApp.tsx:479`, a literal UI copy string (`"Bearer ${QUEUEPROOF_MCP_TOKEN}"` inside a plain double-quoted string, not a template literal) shown to the user as example MCP-client config text. It is not interpolated and no real token value is bundled.
- No `.env` file (only `.env.example`, values blank) was ever committed in any of the 5 commits.
- Local Wrangler/Miniflare SQLite state (`.wrangler/state/v3/d1/*.sqlite`, binary — searched with `strings` since ripgrep skips binaries by default) contained no plaintext matches for any secret pattern.

---

## What's implemented well (for balance)

- Tenant isolation via `workspace_id`-scoped SQL is consistent across all 21 API routes and all MCP tools once identity is resolved.
- HydraDB API keys are encrypted at rest with AES-256-GCM (`lib/server/crypto.ts`), random IV per encryption, never returned to the client, and only a truncated SHA-256 fingerprint is exposed.
- MCP bearer tokens are stored only as SHA-256 hashes (`app/api/mcp-tokens/route.ts:60`), shown in plaintext exactly once at creation, and revocation is scoped to the owning workspace.
- `/mcp` remote endpoint auth is fail-closed, constant-time compared, and correctly derives `workspaceId` from the authenticated token record rather than trusting client input.
- Outbound HydraDB requests re-validate origin after URL construction (`packages/hydradb/src/client.ts:31`) to prevent path-based origin drift.
