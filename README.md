# QueueProof

**A defensible next action—with receipts.**

QueueProof is an agent priority and execution control plane. It retrieves live work evidence through HydraDB, ranks work with a deterministic policy, exposes the result to people and MCP clients, and keeps all write actions proposal-only until a human approves them.

## Current truth

The application starts in a legitimate empty state. No sample connectors, queue items, metrics, sync times, or “successful” calls appear in production. The provider catalogue is loaded from HydraDB only after a user submits a newly generated HydraDB API key through the encrypted onboarding form.

Implemented and locally verified:

- Dynamic HydraDB v2 provider catalogue, discovery, connector creation, resource configuration, sync request, canary query, and proof-state persistence.
- AES-GCM credential envelopes; credentials never return to the browser after submission.
- D1 schema with 44 workspace-owned tables and generated migration.
- Grounded query planning with source extraction and prompt-injection flags.
- Deterministic 100-point ranking, comparison, and counterfactual functions.
- Authenticated Streamable HTTP MCP endpoint with read/propose boundaries.
- Responsive “Circuit Shrine” product shell and truthful connector/Ask zero states.
- Vitest contract, ranking, retrieval, security, fixture, and MCP tests.

Not yet live-verified in this repository:

- Slack, Gmail, and Linear credentials/resources/syncs.
- Cross-source queue generation from a real workspace.
- A remote MCP client handshake.
- Approval-gated provider write execution.

Private deployment: `https://queueproof-control-plane.vaibhav09908.chatgpt.site`. Owner sign-in is required.

Those items require external credentials. They are not replaced with fixture data.

## Start

Prerequisites: Node.js 22.13+ and pnpm.

```bash
pnpm install
Copy-Item .env.example .env.local
pnpm dev
```

Open `http://localhost:3000`. External credentials are optional at startup. To connect real data, create a fresh HydraDB key and paste it into the web onboarding form—never into chat, source control, or a CLI argument.

## Verification

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm doctor
pnpm deploy:check
```

Fixture evaluation is explicitly gated:

```bash
$env:QUEUEPROOF_TEST_MODE="true"
pnpm eval
```

Live acceptance refuses to run without the live flag, URL, and HydraDB key:

```bash
$env:QUEUEPROOF_LIVE_TEST="true"
$env:QUEUEPROOF_URL="https://your-deployment.example"
$env:HYDRADB_API_KEY="..."
pnpm test:live
```

## Architecture

The vinext application targets Cloudflare Sites/Workers with D1 and R2 bindings. HydraDB remains the retrieval and connector plane. The UI, API routes, MCP gateway, contracts, ranking, retrieval, connector adapter, and security functions share one TypeScript workspace.

See [ARCHITECTURE.md](ARCHITECTURE.md), [SECURITY.md](SECURITY.md), [DEPLOYMENT.md](DEPLOYMENT.md), and [BUILD_STATUS.md](BUILD_STATUS.md).

## MCP

Remote MCP is fail-closed unless both `QUEUEPROOF_MCP_TOKEN` and `QUEUEPROOF_MCP_WORKSPACE_ID` are configured. Use a secret environment variable in clients; never embed the token in checked-in JSON.

```bash
codex mcp add queueproof --url https://your-deployment.example/api/mcp \
  --bearer-token-env-var QUEUEPROOF_MCP_TOKEN
```

The server publishes workspace-scoped queue, change, connector, skill, memory, evaluation, and action-proposal tools. Proposing an action is not executing it.

## Repository map

- `app/` — web UI, authenticated APIs, MCP route.
- `packages/` — contracts, HydraDB, connector, retrieval, ranking, security, MCP.
- `db/` and `drizzle/` — schema and migration.
- `skills/` — portable QueueProof skill packages.
- `cli/` — project-scoped client installers and operator commands.
- `evals/` — test-only labelled fixtures.
- `submission/` — evidence matrix and demo copy.
- `docs/research/` — dated contract research with official sources.

## Responsible disclosure

Do not open a public issue for a vulnerability. Follow [SECURITY.md](SECURITY.md). Never include real customer source content in screenshots, test fixtures, or submission assets.
