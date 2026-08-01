# Submission form answers

Filled sections are true as written. Sections marked **PENDING** must not be submitted
until the underlying operation has actually succeeded.

## Product name

QueueProof: agent priority and execution control plane.

## One-line description

QueueProof applies a deterministic, versioned priority policy to work evidence and
persists an auditable Execution Packet that a person and an MCP agent read from the same
record.

## Live URL

<https://queueproof.vercel.app>

State it honestly if asked: the deployment is up, but no database is bound to it, so it
renders a setup screen naming the environment variables it needs rather than a dashboard
of invented data. `GET /api/health/ready` returns 503 with `databaseBinding`,
`uploadBinding`, and `encryptionKey` all false. The full product runs locally with no
accounts required.

If a judge probes further: `uploadBinding` is a Cloudflare R2 binding that the Vercel
runtime cannot supply, so that endpoint returns 503 on Vercel regardless of configuration.
That is a known defect in the readiness check, recorded in `ARCHITECTURE.md`, not evidence
that storage is broken. Also note that `/api/health/dependencies` reports
`hydradb.configuredPerWorkspace: true` as a hardcoded literal; it does not indicate a live
HydraDB connection.

## Repository URL

**PENDING.** No public repository is configured. The only git remote on this tree is an
internal Sites host, which is not viewable by a judge. Publish to a public host and paste
the URL here before submitting.

## Video URL

**PENDING.** Record using `submission/60-second-script.md`, which is limited to beats that
can actually be performed. Do not record the gated beats listed at the bottom of that
file.

## Stack

Next.js 16 and React 19, TypeScript, Zod contracts, Drizzle schema, Vitest. Two runtimes:
Vite with `@cloudflare/vite-plugin` (Miniflare-emulated D1 and R2) for development, and
Vercel via `next build --webpack`, where storage resolves through a D1-compatible adapter
over hosted libSQL/Turso or `node:sqlite`. MCP is served from an authenticated,
workspace-bound endpoint.

## HydraDB usage

QueueProof is written against the HydraDB v2 HTTP contract (`https://api.hydradb.com`,
Bearer auth, `API-Version: 2`). It is designed to load connector and provider contracts
from the runtime catalogue, discover resources, request sync, verify source presence with
a canary query, and use fast or thinking retrieval, retaining provider attribution,
source timestamps, request IDs, and latency in the proof trace.

State the boundary plainly: **this path has never been run against a live HydraDB
account.** No API key is present in the repository and no fixture is substituted for one.
The connector layer is provider-agnostic, and there is no Linear, Slack, or Gmail
integration in the tree: no provider client, no auth flow, no API call. Those names appear
only in query-routing and title-cleanup regexes, UI example copy, and routing test
fixtures, none of which contacts a provider.

## What is technically distinctive

Connection is treated as a multi-stage proof protocol rather than a saved credential: a
connector moves through 14 explicit states and only reaches `data_verified` after a canary
query returns content attributable to that provider. Ranking is a pure, versioned
function, so the same evidence always yields the same answer and policy changes are
diffable. Retrieved provider content is treated as an untrusted evidence plane that
cannot alter system policy or permissions. Agent writes are split into propose, approve,
execute, and verify, and only the proposal side exists, so the system cannot perform a
provider write.

## What is verifiably working today

Checkable on a laptop with no accounts:

- Durable storage over libSQL/Turso and `node:sqlite`; workspace created, persisted, and
  duplicate rejected.
- HMAC-signed httpOnly session cookies. Nine attack variants all return 401; a valid
  session returns 200.
- Authenticated MCP endpoint. Handshake negotiates protocol `2025-11-25` and offers 13
  tools to a read plus propose token, with scope gating at registration. The static
  fallback credential keeps the full scope set, so scope narrowing applies to app-issued
  tokens only.
- `queueproof_propose_action` is idempotent: the same idempotency key returns the same
  proposal ID.
- Deterministic ranking policy with explicit components, penalties, bands, and written
  explanations.
- 90 tests pass across 9 files. Typecheck, lint, and the production build are clean. A
  secret scan over the tree, the full git history, and the build output found zero
  secrets.

## What is explicitly not built

Do not claim any of these anywhere in the submission: document or PDF upload and
ingestion; an evaluation lab or any accuracy, latency, or cost figure; memory; a skills
runtime; decision replay; execution leases; change-ledger diffing; a provider write
executor; and OAuth 2.1 for MCP. Counterfactual arithmetic exists in the ranking package
but has no production caller, so it is not a product feature.

## Verified connectors, synced resources, evaluation figures

**PENDING, and blocked on credentials.** These require a HydraDB API key and provider
authorisation. Leave blank or answer "none yet" rather than estimating. No connector has
been run live and no provider write has ever been executed.
