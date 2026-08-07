# QueueProof remote MCP setup

## Fastest judge path: read-only public demo

For a zero-credential evaluation against QueueProof's synthetic Helios workspace, add
`https://queueproof.vercel.app/mcp/demo` as a custom MCP server and select **No
authentication**. This endpoint registers read tools only, is bound to the deliberately
provisioned public workspace, and has durable per-client and deployment-wide rate limits.
It cannot sync connectors, create proposals, approve changes, or execute provider writes.

Personal workspaces continue to use the canonical authenticated endpoint below. The demo
endpoint is not an authentication bypass for personal data.

## Current contract

| Field | Value |
| --- | --- |
| Canonical endpoint | `https://queueproof.vercel.app/mcp` |
| Compatibility alias | `https://queueproof.vercel.app/api/mcp` |
| Transport | Streamable HTTP / JSON-RPC, with JSON or SSE responses |
| Authentication | Supabase OAuth access token or legacy QueueProof bearer token |
| OAuth resource/audience | `https://queueproof.vercel.app/mcp` |
| OAuth scopes | `openid`, `profile`, `email` |
| QueueProof permissions | Read by default; proposal/sync only through trusted server claims or scoped opaque tokens |
| Resource metadata | `/.well-known/oauth-protected-resource/mcp` |

The production endpoint rejects anonymous and invalid bearer requests. That boundary has test
coverage, but an authenticated production handshake is not claimed until a real workspace token
is supplied and a current smoke-test receipt is recorded.

OAuth is conditional, not assumed. Protected-resource metadata returns a successful discovery
document only when the complete Supabase configuration and canonical resource are present. This is
separate from Supabase-only production web sign-in. MCP resource authentication on a Vercel
production install defaults to `hybrid`; operators can explicitly select `opaque|hybrid|supabase`
with `QUEUEPROOF_MCP_AUTH_MODE`. QueueProof is the OAuth resource server; Supabase owns
authorization, consent, PKCE, token issuance, and revocation.

Enable Supabase OAuth 2.1, set the custom authorization path to
`https://queueproof.vercel.app/oauth/authorize`, enable dynamic client registration or register a
dedicated ChatGPT client, and enable `public.queueproof_access_token_hook`. The hook gives OAuth
tokens the exact audience `https://queueproof.vercel.app/mcp`; QueueProof rejects ordinary web
session tokens because they lack that audience and OAuth `client_id`. Supabase supports only
standard identity scopes today, so QueueProof maps a valid token to read-only internally. Broader
permissions require the trusted custom claim and are not part of the initial ChatGPT grant.

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
QUEUEPROOF_URL=https://queueproof.vercel.app node cli/queueproof.mjs ask \
  "Who escalated the AuthShield outage?" --connectors <connector-id-1,connector-id-2>
```

Use connector IDs returned by `connectors list`, or use `--sources` with indexed document source
IDs returned by `queueproof_list_documents`. QueueProof resolves databases, collections, and exact
lineage server-side. Never guess or copy a private database name into client input.

## Exposed tools

The server registers the following implemented tools. Availability of scoped tools depends on the
token.

| Tool | Scope/behavior |
| --- | --- |
| `queueproof_health` | Read-only durable-storage probe |
| `queueproof_list_connectors` | Read sanitized connector IDs, search coordinates, and proof states |
| `queueproof_list_documents` | Read sanitized document ingestion receipts and search coordinates |
| `queueproof_verify_connector` | Read a stored verification receipt |
| `queueproof_search` | Search verified connectorIds or indexed document sourceIds and return lineage-filtered, sanitized evidence excerpts |
| `queueproof_get_next_actions` | Read the latest positive-score ranked actions |
| `queueproof_get_execution_packet` | Read a workspace-owned packet |
| `queueproof_explain_priority`, `queueproof_compare_priorities` | Read persisted ranking details |
| `queueproof_list_queue_snapshots` | Read snapshots; it does not compute a diff |
| `queueproof_get_action_status` | Read proposal/approval/execution state |
| `queueproof_sync_connector` | Requires `queueproof:sync`; requests an existing connector sync |
| `queueproof_report_execution_result` | Requires `queueproof:propose`; records an agent result, not a provider write |
| `queueproof_propose_action` | Requires `queueproof:propose`; creates a grounded Linear issue proposal only |

There is no MCP tool that approves or executes a provider action. The server registers two fixed,
sanitized resources—`queueproof://current/connectors` and
`queueproof://current/queue-snapshots`—without exposing an internal workspace ID. It does not
register MCP prompts. Starter prompts belong in the OpenAI listing. Do not advertise removed
entity, timeline, commitment, conflict, counterfactual, skill, or evaluation tools.

## Minimal JSON-RPC smoke test

Use the repository CLI when possible because it handles JSON and SSE. For protocol debugging,
send `initialize`, then `tools/list`, then one harmless read-only `tools/call`. Keep the token in an
environment variable and suppress command tracing. A complete release receipt records:

- production SHA and deployment ID;
- client name and negotiated protocol version;
- names returned by `tools/list`;
- one successful read-only tool and a sanitized result; and
- anonymous and invalid-token rejection.

Never paste the bearer value into the receipt.

## Revocation and troubleshooting

The owner can revoke a client under **Connect AI**. Revoked, expired, wrong-audience, missing, and
unknown tokens fail with HTTP 401. A deployment with neither durable token storage nor a configured
static fallback returns 503. Cross-origin browser requests are rejected unless their origin matches
the MCP endpoint.

If discovery returns 503, OAuth mode is intentionally incomplete or disabled; it does not make a
valid legacy token invalid in `opaque` or `hybrid` mode. Do not claim a named ChatGPT connection
until OAuth consent, `initialize`, `tools/list`, and one harmless read-only production tool call
have all succeeded against the same deployed release.

See [ChatGPT setup](CHATGPT_MCP_SETUP.md), [MCP security](MCP_SECURITY.md),
[Claude workflow](CLAUDE_QUEUEPROOF_WORKFLOW.md), and [Codex workflow](CODEX_QUEUEPROOF_WORKFLOW.md).
