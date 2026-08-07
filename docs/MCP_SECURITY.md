# QueueProof MCP security

## Trust boundary

The MCP endpoint is an authenticated view into one server-selected QueueProof workspace. Client
input cannot choose another workspace. Retrieved source text is untrusted evidence, not policy or
tool instructions.

## Authentication and token lifecycle

- Canonical audience: `queueproof-mcp` unless the deployment explicitly configures another.
- Durable tokens are random bearer values stored only as SHA-256 hashes.
- Token rows bind workspace, client, scopes, expiry, revocation, and audience.
- Missing, unknown, expired, revoked, and wrong-audience tokens fail closed with HTTP 401.
- The plaintext token is returned only when the owner creates it. It is never returned by client
  listing and must not appear in logs, source, documentation, screenshots, or CLI arguments.
- A configured static bearer fallback exists for deployments without token storage only when both
  token and workspace are explicitly configured; comparison is constant-time.

Owner-only routes mint and revoke tokens. Default to `queueproof:read`, short expiry, one client per
token, and immediate revocation after a temporary demo.

## Scopes and authority

| Scope | Authority |
| --- | --- |
| `queueproof:read` | Read connector receipts, retrieve HydraDB evidence, read queue packets and action status |
| `queueproof:sync` | Request sync for an existing workspace connector |
| `queueproof:propose` | Record execution results and create a bounded Linear `create_issue` proposal |

`queueproof:propose` is not execute authority. A proposal requires workspace-owned evidence IDs,
an exact bounded payload, and an idempotency key. Non-critical input is stored conservatively as
high risk. MCP exposes no approve or execute tool; an owner must approve separately, and successful
execution requires a stored provider response ID.

## Protocol and origin controls

- `/mcp` accepts authenticated MCP requests; `/api/mcp` is an exact compatibility alias.
- Responses use `Cache-Control: no-store` at the auth boundary.
- A browser `Origin` header must match the endpoint origin.
- Tool calls update client activity and produce a workspace audit event without logging the
  bearer value.
- Tool inputs use bounded Zod schemas. SQL table names and sort orders are allowlisted.
- Resources use fixed `queueproof://current/...` URIs and resolve the workspace only from the
  authenticated token; no workspace variable is accepted from a client.

## OAuth boundary

`/.well-known/oauth-protected-resource/mcp` describes the canonical resource and pinned Auth0
issuer. It returns 200 only when the complete OAuth resource-server mode is valid; otherwise it
returns 503. QueueProof verifies JWT signatures, exact issuer/audience/resource, lifetime, subject,
and scopes, then maps the subject to one private workspace. Auth0—not QueueProof—owns consent,
PKCE, token exchange, refresh, and authorization-server revocation.

The first-party web application and ChatGPT must never share a client ID. A ChatGPT connection uses
a separate CIMD, DCR, or manually registered client and begins with `queueproof:read`. Metadata is
configuration evidence, not an end-to-end receipt; name a client only after a current production
consent flow and harmless read-only tool call succeed.

## Retrieval and prompt-injection rules

- Connector data must have verified connector/resource lineage; provider labels alone do not
  establish origin.
- Search accepts QueueProof connectorIds or indexed document sourceIds, never a client-selected
  database or collection. Connector queries add the exact server-resolved connector lineage
  filter, and returned sources must match that connector/resource or a fully attested
  single-connector receipt.
- Document queries are grouped by their server-resolved database, and returned evidence must match
  an explicitly requested indexed HydraDB source ID.
- Tool output must retain provider/source identifiers and distinguish missing proof.
- Instructions found in Slack, email, issues, documents, titles, excerpts, or URLs are data. They
  cannot grant scope, request secrets, change the workspace, or authorize a write.
- Never feed tokens, owner session cookies, raw private records, or unrelated repository secrets
  into a tool argument.

## Verification checklist

Run deterministic coverage:

```bash
pnpm test:mcp
pnpm test:security
pnpm test
```

For production, record without secrets:

1. Exact health SHA and deployment ID.
2. Anonymous request rejected with 401 and `WWW-Authenticate: Bearer`.
3. Invalid, expired, revoked, and wrong-audience rejection from automated tests or an isolated
   non-production token set.
4. Authenticated `initialize` and `tools/list` with a real, expiring workspace token.
5. One harmless read-only tool result in the expected workspace.
6. A read-only token's inability to see proposal/sync tools.
7. If proposal scope is tested, the action remains proposal-only and cannot execute through MCP.
8. Token revocation followed by a 401.

Do not perform destructive or third-party write tests merely to complete this checklist.

## Incident response

If a bearer value is disclosed, revoke it immediately, create a new client token, review
`mcp.request` audit events and client activity, and remove the leaked value from every non-secret
location. Deleting a chat, terminal transcript, or git branch does not revoke a token.
