# QueueProof remote MCP setup

## Current contract

| Field | Value |
| --- | --- |
| Canonical endpoint | `https://queueproof.vercel.app/mcp` |
| Compatibility alias | `https://queueproof.vercel.app/api/mcp` |
| Transport | Streamable HTTP / JSON-RPC, with JSON or SSE responses |
| Authentication | `Authorization: Bearer <token>` |
| Default audience | `queueproof-mcp` |
| Scopes | `queueproof:read`, `queueproof:propose`, `queueproof:sync` |
| Resource metadata | `/.well-known/oauth-protected-resource/mcp` |

The production endpoint rejects anonymous and invalid bearer requests. That boundary has test
coverage, but an authenticated production handshake is not claimed until a real workspace token
is supplied and a current smoke-test receipt is recorded.

OAuth is conditional, not assumed. Protected-resource metadata returns a successful discovery
document only when `QUEUEPROOF_OAUTH_ISSUER` is configured. QueueProof currently implements
workspace-bound bearer validation; it does not itself implement an authorization server, browser
consent flow, PKCE exchange, or refresh-token issuance.

## Create a connection key

Token creation is owner-only. Sign in at `https://queueproof.vercel.app/owner`, open **Connect
AI**, choose read-only unless proposal/sync access is necessary, and create a short-lived key.
The plaintext is returned only at creation. Store it in the environment that launches the client:

```bash
export QUEUEPROOF_MCP_TOKEN="<connection-key>"
```

Do not put the value in source, a shell-history snippet, a screenshot, or an MCP config file.

## Verify with the repository CLI

From the repository root:

```bash
QUEUEPROOF_URL=https://queueproof.vercel.app node cli/queueproof.mjs mcp verify
```

This performs `initialize` and `tools/list`. A successful result names the QueueProof server,
negotiated protocol version, and discovered tools. It does not prove a retrieval tool until one is
called.

Read-only checks can continue with:

```bash
QUEUEPROOF_URL=https://queueproof.vercel.app node cli/queueproof.mjs connectors list
QUEUEPROOF_URL=https://queueproof.vercel.app node cli/queueproof.mjs ask "Who escalated the AuthShield outage?" --database <database>
```

Use the exact database shown to the authenticated owner. Do not guess or copy a private database
name into public documentation.

## Exposed tools

The server registers the following implemented tools. Availability of scoped tools depends on the
token.

| Tool | Scope/behavior |
| --- | --- |
| `queueproof_health` | Read-only durable-storage probe |
| `queueproof_list_connectors` | Read connector rows for the token workspace |
| `queueproof_verify_connector` | Read a stored verification receipt |
| `queueproof_search`, `queueproof_ask` | Run observable HydraDB retrieval |
| `queueproof_get_next_actions` | Read the latest positive-score ranked actions |
| `queueproof_get_execution_packet` | Read a workspace-owned packet |
| `queueproof_explain_priority`, `queueproof_compare_priorities` | Read persisted ranking details |
| `queueproof_list_queue_snapshots` | Read snapshots; it does not compute a diff |
| `queueproof_get_action_status` | Read proposal/approval/execution state |
| `queueproof_sync_connector` | Requires `queueproof:sync`; requests an existing connector sync |
| `queueproof_report_execution_result` | Requires `queueproof:propose`; records an agent result, not a provider write |
| `queueproof_propose_action` | Requires `queueproof:propose`; creates a grounded Linear issue proposal only |

There is no MCP tool that approves or executes a provider action. The server currently registers
resources for queue snapshots, changes (also raw snapshots), and connectors under the authenticated
workspace URI. It does not register MCP prompts. Do not advertise removed entity, commitment,
conflict, skill, or evaluation tools.

## Minimal JSON-RPC smoke test

Use the repository CLI when possible because it handles JSON and SSE. For protocol debugging,
send `initialize`, then `tools/list`, then one harmless read-only `tools/call`. Keep the token in an
environment variable and suppress command tracing. A complete release receipt records:

- production SHA and deployment ID;
- client name and negotiated protocol version;
- names returned by `tools/list`;
- one successful read-only tool and its request/audit identifier when available; and
- anonymous and invalid-token rejection.

Never paste the bearer value into the receipt.

## Revocation and troubleshooting

The owner can revoke a client under **Connect AI**. Revoked, expired, wrong-audience, missing, and
unknown tokens fail with HTTP 401. A deployment with neither durable token storage nor a configured
static fallback returns 503. Cross-origin browser requests are rejected unless their origin matches
the MCP endpoint.

If discovery returns 503, that means no OAuth issuer is configured; it does not make a valid bearer
token invalid. If a named client requires browser OAuth and cannot accept an authorization header,
do not claim that client is supported until a compatible authorization server is deployed and
tested.

See [MCP security](MCP_SECURITY.md), [Claude workflow](CLAUDE_QUEUEPROOF_WORKFLOW.md), and
[Codex workflow](CODEX_QUEUEPROOF_WORKFLOW.md).
