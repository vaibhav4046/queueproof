# QueueProof

**The evidence-backed control plane for autonomous work.**

Agents can execute. QueueProof decides what deserves execution next, proves why, and
keeps the final write behind a human approval boundary.

Live product: <https://queueproof.vercel.app>

## The product loop

1. **Connect evidence.** QueueProof discovers live provider contracts from HydraDB,
   encrypts credentials at rest, scopes each connector, and refuses to call it verified
   until a canary query returns provider-attributable records.
2. **Add documents.** PDF, Markdown, and text files are signature-validated, bounded to
   25 MB, hashed for duplicate prevention, streamed to HydraDB, and shown with their real
   indexing stage.
3. **Ask across systems.** One question fans out across every verified source. The answer
   includes excerpts, source links, timestamps, provider attribution, and the retrieval
   trace. Conflicts remain conflicts; unsupported prose is never filled in.
4. **Compile the queue.** A deterministic, versioned policy ranks retrieved commitments.
   Each item becomes a persisted Execution Packet containing evidence, constraints,
   dependencies, acceptance criteria, permissions, component scores, and a receipt hash.
5. **Review the write.** An agent or person can convert a packet into an exact Linear issue
   proposal. The Approvals control plane shows the complete payload, evidence chain, and
   risk class before requiring an explicit second confirmation.
6. **Execute at most once.** A unique database claim is acquired before the Linear call.
   Replays and double-clicks cannot create a second provider issue, and QueueProof reports
   success only when Linear returns a real issue id.

## Live evidence, 2 August 2026

- Durable hosted Turso/libSQL storage; `/api/health/ready` returns `200 ready`.
- HydraDB configured through the product; the browser only receives its encrypted-secret
  fingerprint.
- **Linear, Slack, and GitHub** reached `data_verified` through create → discover → scope →
  sync → proof. Gmail is authenticated and configured, but remains unverified while its
  free-plan backfill advances; QueueProof correctly refuses to promote it early.
- A six-question production benchmark returned evidence from all three verified providers
  on **6/6 questions**. Measured latency: **p50 4,401 ms**, **p95 6,347 ms**, min 990 ms,
  max 6,347 ms. This is a small measured sample, not a long-term SLA.
- Document ingestion reached a real HydraDB source id and terminal `indexed` state.
- Router fixture accuracy is **29/39 = 74.4%** across 15 labelled categories. All 325
  fixture-computable assertions pass. The score is printed as measured, not rounded up.
- **217 tests across 20 files** pass. Typecheck, lint, production build, and deployment
  binding checks are clean.

The complete measurements and caveats live in [BENCHMARK_REPORT.md](BENCHMARK_REPORT.md)
and [submission/requirements-matrix.md](submission/requirements-matrix.md).

## What makes it trustworthy

- HMAC-SHA-256 signed, httpOnly sessions; identity is never trusted from a caller-supplied
  header unless an explicitly configured gateway owns that boundary.
- AES-GCM credential encryption with a random IV per secret.
- Workspace ownership enforced server-side on every operational row.
- Prompt-injection screening on evidence that is about to cross into a provider write.
- Scoped, expiring, revocable MCP tokens stored only as hashes.
- The same persisted packet and receipt hash are read by the web app, API, and MCP server.
- No fixture fallback in production. Missing storage, credentials, evidence, or provider
  proof produces a named failure state rather than a fabricated dashboard.

## Architecture

| Layer | Responsibility |
|---|---|
| Next.js / React 19 | Server-rendered product shell and authenticated control planes |
| HydraDB | Provider catalogue, connector lifecycle, retrieval, document indexing |
| Turso / libSQL | Durable workspace, proof, packet, token, document, approval, and audit state |
| `packages/retrieval` | Deterministic query planning and cross-source evidence normalization |
| `packages/ranking` | Pure, versioned priority policy and score deltas |
| `packages/actions` | Exact Linear payloads, risk classification, redaction, provider execution |
| MCP | Scoped agent access to the same workspace-bound product state |

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm install
```

Create `.env.local`:

```bash
QUEUEPROOF_ENCRYPTION_KEY=<at least 16 characters; use a 32-byte random secret>
QUEUEPROOF_ALLOW_LOCAL_IDENTITY=true
QUEUEPROOF_SQLITE_PATH=.data/queueproof.db
QUEUEPROOF_TEST_MODE=false
```

Then start the app:

```bash
npm run dev
```

For hosted storage, replace `QUEUEPROOF_SQLITE_PATH` with
`TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`. Enter the HydraDB credential inside the
Sources UI. `LINEAR_API_KEY` is optional: without it approvals are durably recorded but
the exact Linear payload is not executed.

## Verify

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run deploy:check
```

Additional gates:

```bash
npm run test:security
npm run test:mcp
npm run eval
npm run doctor
```

## Honest boundaries

- Gmail is configured and authenticated, not yet `data_verified`; the free HydraDB plan's
  backfill cadence is still advancing. It is never counted among the three live sources.
- Linear execution code is production-built and provider-mocked in tests, but no claim is
  made that the current public deployment has created a real Linear issue until a live
  provider receipt is recorded.
- Citation precision and recall, cost per query, memory, a skills runtime, decision replay,
  execution leases, and change-ledger diffing are not claimed.
- The six-query live latency run is deliberately labelled as a small sample.

## Demo

Use [submission/60-second-script.md](submission/60-second-script.md) for the judge flow and
[submission/judge-one-pager.md](submission/judge-one-pager.md) for the concise evidence pack.
