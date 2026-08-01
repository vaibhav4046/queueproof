# QueueProof

Agents can already execute. What they cannot do is justify which piece of work deserves
execution next. QueueProof is a control plane for that decision: it applies a
deterministic, versioned priority policy to work evidence and persists an auditable
Execution Packet that a person and an MCP agent read from the same row.

This README states what is built and what is not. Claims below are limited to behaviour
that has been exercised. Anything requiring a HydraDB account or provider authorisation
is listed under [Not implemented yet](#not-implemented-yet) or
[Blocked on credentials](#blocked-on-credentials), not described as working.

## What actually works today

- **Durable storage on both runtimes.** `lib/server/d1-compat.ts` reimplements the
  Cloudflare D1 statement surface (`prepare`/`bind`/`first`/`all`/`run`/`batch`) over
  hosted libSQL/Turso and over `node:sqlite`. Exercised locally: workspace created,
  persisted across requests, duplicate rejected.
- **Session authentication.** HMAC-SHA-256 signed, httpOnly session cookie issued by
  `/api/session`. Nine attack variants were run against a production build and all
  returned 401: spoofed `oai-authenticated-user-email` header;
  `Host: localhost.attacker.example`; `Host: localhost` reading `/api/mcp-tokens`; no
  credentials; wrong access token; signature replaced with garbage; payload swapped to
  another email with the signature kept; unsigned payload; and a correctly signed but
  expired cookie. A valid session cookie returned 200. That set was run by hand and
  recorded in [BUILD_STATUS.md](BUILD_STATUS.md). No automated test covers it, which is
  the softest spot in the security story.
- **MCP endpoint.** Authenticated, workspace-bound. The handshake completes and
  negotiates protocol version `2025-11-25`. A read plus propose token is offered 13
  tools. `queueproof_propose_action` is idempotent: the same `idempotencyKey` returns
  the same `proposalId` rather than creating a second proposal.
- **Deterministic ranking policy.** `packages/ranking` is a pure function. Nine positive
  components and a penalty map are summed, clamped to 0 to 100, and bucketed into
  `critical`/`high`/`normal`/`low`. Completed or cancelled work takes a 100 point
  penalty so it can never rank. Every result carries `policyVersion`
  (`queueproof-default-1.0.0`) and a plain-language explanation array.
- **Credential encryption.** AES-GCM via WebCrypto with a random IV per secret, keyed by
  a SHA-256 digest of `QUEUEPROOF_ENCRYPTION_KEY`. Stored as a base64 envelope. The UI is
  only ever given a 16 character fingerprint, never the secret.
- **MCP token lifecycle.** Tokens are shown once in plaintext, stored only as a hash,
  carry an audience, an expiry, and explicit scopes (`queueproof:read`,
  `queueproof:propose`, `queueproof:sync`), and can be revoked. Scope gating is enforced
  at tool registration, so a token issued through the app is never offered tools outside
  its scopes. One caveat worth stating: the static fallback credential
  (`QUEUEPROOF_MCP_TOKEN` with `QUEUEPROOF_MCP_WORKSPACE_ID`) authenticates without a
  stored token row and therefore keeps the default full scope set. Scope narrowing today
  applies to app-issued tokens, not to that fallback.
- **Connector state machine.** `packages/contracts` defines 14 explicit states from
  `not_configured` through `resources_discovered`, `initial_sync_requested`, and
  `sync_in_progress` to `data_verified`, plus the failure states `degraded`,
  `authentication_expired`, `permission_insufficient`, `rate_limited`, and `failed`.
  "Connected" is never inferred from a saved credential.
- **Audit write path.** `audit_events` is written on operational transitions and every
  operational row is workspace-owned.
- **Quality gates.** 90 tests pass across 9 files. Typecheck, lint, and the production
  build are clean. A secret scan over the working tree, the full git history, and the
  build output found zero secrets.

## Live deployment

<https://queueproof.vercel.app>

The deployment is up, but **no database is bound to it** and no environment variables are
set. It therefore renders a setup screen naming the environment variables it needs,
rather than a fake dashboard. This is the intended failure mode, and it is checkable
without an account:

```bash
curl https://queueproof.vercel.app/api/health/live
# {"status":"live","service":"queueproof-web", ...}                      HTTP 200

curl -i https://queueproof.vercel.app/api/health/ready
# {"status":"not_ready","checks":{"databaseBinding":false,
#  "uploadBinding":false,"encryptionKey":false}}                         HTTP 503

curl https://queueproof.vercel.app/api/health/dependencies
# storage.configured=false, backend="none",
# detail="No durable storage configured. Set TURSO_DATABASE_URL and
#         TURSO_AUTH_TOKEN (hosted) or QUEUEPROOF_SQLITE_PATH (local)."

curl https://queueproof.vercel.app/api/session
# {"ok":true,"signInConfigured":false,"actor":null}
```

Two things about those responses that are easy to misread, so they are stated here rather
than discovered later:

- **`/api/health/ready` stays 503 on Vercel even once storage is configured.** It requires
  `uploadBinding`, which is the Cloudflare R2 `FILES` binding, and the Vercel runtime has
  no Cloudflare bindings. So configuring `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and
  `QUEUEPROOF_ENCRYPTION_KEY` correctly would clear the user-facing setup screen, which is
  gated on storage availability, while readiness still reports 503. The check is also
  weak in the other direction: the Vercel runtime falls through to `process.env`, so a
  stray `FILES` variable of any value would flip it to 200 and claim an upload binding
  that does not exist. Readiness is the wrong shape for this runtime. It is reported here
  as a known defect, not as a feature.
- **`/api/health/dependencies` reports `hydradb.configuredPerWorkspace: true`
  unconditionally.** That field is a hardcoded literal, not a live check. Read the
  `storage.*` fields only. No HydraDB connection is implied by it.

To see the product with storage, run it locally. That takes no accounts.

## Run it locally

Prerequisites: Node.js 22.13 or newer. No HydraDB account, no provider authorisation, and
no third-party service is required for the local run.

```bash
npm install
```

Create `.env.local` (it is gitignored). Note that `.env.example` is incomplete: it does
not list `QUEUEPROOF_ALLOW_LOCAL_IDENTITY`, `QUEUEPROOF_ACCESS_TOKEN`,
`QUEUEPROOF_TRUSTED_IDENTITY_PROXY`, `QUEUEPROOF_MCP_AUDIENCE`, `TURSO_DATABASE_URL`,
`TURSO_AUTH_TOKEN`, or `QUEUEPROOF_SQLITE_PATH`, all of which are read by shipped code.
For a local run you need only:

```bash
QUEUEPROOF_ENCRYPTION_KEY=<32 random bytes, base64>
QUEUEPROOF_ALLOW_LOCAL_IDENTITY=true
QUEUEPROOF_TEST_MODE=false
```

Generate the key with:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Then:

```bash
npm run dev
```

`npm run dev` runs Vite with `@cloudflare/vite-plugin`, so the D1 and R2 bindings are
emulated locally by Miniflare and their state lives in `.wrangler/`. With the two
variables above set, readiness passes and a local workspace actor is issued without any
sign-in:

```bash
curl http://localhost:3000/api/health/ready
# {"status":"ready","checks":{"databaseBinding":true,
#  "uploadBinding":true,"encryptionKey":true}}                           HTTP 200

curl http://localhost:3000/api/session
# {"ok":true,"signInConfigured":false,
#  "actor":{"displayName":"Local workspace","localDevelopment":true}}
```

The dev server picks the next free port if 3000 is taken, and prints the one it chose.
On some Windows setups it binds IPv6 loopback only, so use `http://[::1]:<port>` if
`127.0.0.1` refuses the connection.

`QUEUEPROOF_ALLOW_LOCAL_IDENTITY` is deliberately fail-closed: it is ignored unless
explicitly `true`, so it cannot silently grant an unauthenticated actor in a deployment.

### The Vercel storage path

The hosted runtime is a different code path from `npm run dev`. `next build --webpack`
aliases `lib/server/runtime-provider.ts` to `lib/server/runtime-vercel.ts`, which resolves
storage through `lib/server/d1-compat.ts`:

| Backend | Variables | Use |
|---|---|---|
| libSQL / Turso | `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | Hosted, serverless-safe, plain `fetch` |
| `node:sqlite` | `QUEUEPROOF_SQLITE_PATH` | Local and CI, built into Node, no dependency |

If neither is set the app reports `not_ready` and says which variables are missing. It
does not fall back to fixtures or to browser storage.

## Run the tests

```bash
npm test         # 90 tests, 9 files
npm run typecheck
npm run lint
npm run build
```

Latest run on this tree:

```
 ✓ tests/security.test.ts        (13 tests)
 ✓ tests/ssrf.test.ts            (17 tests)
 ✓ tests/retrieval.test.ts        (6 tests)
 ✓ tests/cli-config.test.ts       (5 tests)
 ✓ tests/eval-fixtures.test.ts   (33 tests)
 ✓ tests/ranking.test.ts          (4 tests)
 ✓ tests/contracts.test.ts        (5 tests)
 ✓ tests/evidence-pairing.test.ts (5 tests)
 ✓ tests/mcp.test.ts              (2 tests)

 Test Files  9 passed (9)
      Tests  90 passed (90)
```

Read that number honestly. These are contract, security, ranking, and routing tests. 33
of the 90 are fixture classification cases. They do not exercise a live provider, and
they are not evidence that any connector works.

## Not implemented yet

These are absent from the codebase. They are listed so nothing above is mistaken for
them.

- **Document and PDF upload, and HydraDB document ingestion.** There is no upload code.
  `scripts/generate-large-pdf.mjs` is a two line stub that generates nothing.
- **Evaluation lab, and any accuracy, latency, or cost measurement.**
  `scripts/run-evals.mjs` is seven lines and reports the length of a fixture array. No
  quality figure is produced anywhere in this repository.
- **Memory, skills runtime, decision replay, execution leases, and change-ledger
  diffing.** Not built.
- **Counterfactual analysis in the product.** The arithmetic exists in
  `packages/ranking` and is unit tested, but no production code path calls it. It is not
  a user-facing feature.
- **Provider write execution.** By design, the system proposes and records. No approval
  executor exists, and no provider write has ever been executed.
- **OAuth 2.1 authorisation server for MCP.** Not claimed. MCP uses bearer tokens.

Three loose ends that follow from the above, stated so they are not read as evidence of a
hidden feature:

- The MCP server still registers resources named `queueproof-skills` and
  `queueproof-policies`. Their tables are neither created at runtime nor on the read
  allowlist, so reading either throws. An agent listing resources sees two capabilities
  that do not exist.
- It also registers `queueproof-changes`, which does work, but only because it is an alias
  for `queue_snapshots`. It is not a change ledger.
- The app UI names Slack, Gmail, and Linear in its empty-state copy as examples of
  providers a catalogue might expose. That is a prompt to connect one, not a sign that any
  is integrated.

## Blocked on credentials

The connector layer is provider-agnostic. There is no Linear, Slack, or Gmail
*integration* anywhere: no provider client, no auth flow, no API call. Grepping the tree
for those names returns exactly four kinds of hit, none of which contacts a provider, and
they are listed here so none is mistaken for an integration:

1. `packages/retrieval/src/index.ts`: a keyword regex that routes a question to the
   thinking mode when it mentions several sources.
2. `lib/server/queue.ts`: a stop-word regex that discards generic source titles.
3. `app/QueueProofApp.tsx`: empty-state copy offering them as examples of providers a
   HydraDB catalogue might expose.
4. `evals/fixtures/cases.json` and `tests/retrieval.test.ts`: query strings in routing
   fixtures, which assert only how a question is categorised.

Providers are meant to arrive from the HydraDB catalogue at runtime. That means the
following is written but has never been run against a live account, so it is unproven
rather than working:

- Connector create, resource discovery, scoped configure, initial backfill, sync
  reconciliation, and canary-based verification.
- Cross-source Ask with citations and a per-call retrieval trace.
- Queue generation from real evidence, and Execution Packets containing real provider
  sources.

No connector has been run live, and no fixture is substituted to stand in for one. Until
a HydraDB API key and provider authorisation are supplied, these screens return an empty
state rather than invented data.

## MCP

Create a scoped token in the app, then point a client at the deployment:

```json
{
  "mcpServers": {
    "queueproof": {
      "url": "https://your-deployment.example/mcp",
      "headers": { "Authorization": "Bearer ${QUEUEPROOF_MCP_TOKEN}" }
    }
  }
}
```

A read-only token is offered health, connector listing and verification, search, ask,
next actions, execution packet retrieval, priority explanation and comparison, queue
snapshots, and action status. `queueproof:propose` adds `queueproof_propose_action` and
`queueproof_report_execution_result`. `queueproof:sync` adds `queueproof_sync_connector`.
Proposing an action and reporting a result are both records, not provider writes.

## Repository map

- `app/`: web interface and authenticated API routes.
- `lib/server/`: identity, storage facade, credential envelopes, runtime bindings, queue
  generation, audit helpers.
- `packages/`: contracts, HydraDB client, connectors, retrieval routing, ranking,
  security, MCP server.
- `db/` and `drizzle/`: schema and the checked-in migration.
- `tests/`: contract, security, SSRF, ranking, and routing tests.
- `submission/`: hackathon material.

## Security

Do not paste production credentials into chat, source control, screenshots, or CLI
arguments. Submitted secrets are encrypted at rest and are never returned to the browser.
Report vulnerabilities through [SECURITY.md](SECURITY.md).
