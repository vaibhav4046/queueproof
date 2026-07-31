# QueueProof

**A defensible next action—with receipts.**

QueueProof is an evidence-ranked execution control plane. It connects workplace systems through HydraDB, retrieves unresolved work, applies a deterministic priority policy, persists cited Execution Packets, and exposes the same packets to people and MCP agents.

## The product

The principal workflow is deliberately small:

1. Create a workspace and attach a newly generated HydraDB API key.
2. Choose a database and a provider from the live HydraDB catalogue.
3. Supply the provider contract’s credentials and select the exact resource scope.
4. Wait for initial backfill; QueueProof admits the source only after cursor and canary-retrieval proof.
5. Build a cross-source Command queue or ask an evidence question.
6. Open a cited Execution Packet in the browser or retrieve that exact packet ID through MCP.

No sample connectors, queue items, metrics, sync times, or successful calls are inserted in production. If evidence is absent, QueueProof returns an honest empty state.

## Implemented and verified locally

- Dynamic HydraDB v2 catalogue plus per-provider contract hydration.
- Authenticated database list/create flow.
- Connector create, discover, scoped configure, initial backfill, sync, and connection proof.
- Connector-specific cursor hashes, sync reconciliation, and provider-matched canary retrieval.
- AES-GCM credential encryption; submitted secrets never return to the browser.
- Cross-connector Ask retrieval with citations and a per-call trace.
- Cross-connector queue generation using the shared deterministic ranking package.
- Schema-validated, D1-backed Execution Packets shared by web, API, and MCP.
- Expiring, revocable, hash-only workspace MCP tokens with read or proposal/sync scopes.
- Agent completion-result callback that records an event without executing provider writes.
- Prompt-injection screening, secret redaction, audit events, and fail-closed source eligibility.
- Typecheck, lint, production build, browser smoke test, and 67 automated tests.

## External acceptance gate

Live Slack, Gmail, Linear, cross-source quality, and hosted MCP parity require a HydraDB API key and provider authorisation. No such credentials are stored in the repository or substituted with fixtures. See [BUILD_STATUS.md](BUILD_STATUS.md) for the exact current boundary.

## Deployments

- Durable authenticated app: [queueproof-control-plane.vaibhav09908.chatgpt.site](https://queueproof-control-plane.vaibhav09908.chatgpt.site)
- Public launch surface: [queueproof.vercel.app](https://queueproof.vercel.app)

The public Vercel surface sends users to the durable control plane because no Vercel database is attached. Credentials and evidence are never downgraded to browser storage.

## Start and verify

Prerequisites: Node.js 22.13+.

```bash
npm install
npm run dev
```

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
npm run deploy:check
```

## MCP

Create a scoped credential in Agent Dock and keep it in a client-side environment variable:

```json
{
  "mcpServers": {
    "queueproof": {
      "url": "https://your-deployment.example/mcp",
      "headers": {
        "Authorization": "Bearer ${QUEUEPROOF_MCP_TOKEN}"
      }
    }
  }
}
```

Read-only tokens expose health, connector proof, retrieval, queue, priority, and Execution Packet tools. Optional proposal/sync scopes add connector sync, action proposal, and execution-result reporting. Proposing or reporting is not a provider write.

## Repository map

- `app/` — focused web interface and authenticated APIs.
- `lib/server/` — durable orchestration and queue generation.
- `packages/` — contracts, HydraDB, connectors, retrieval, ranking, security, and MCP.
- `db/` and `drizzle/` — D1 schema and migration.
- `tests/` — deterministic contract and security tests.
- `submission/` — hackathon evidence and demo material.

## Security

Never paste production credentials into chat, source control, screenshots, or CLI arguments. Use the encrypted browser onboarding and report vulnerabilities through [SECURITY.md](SECURITY.md).
