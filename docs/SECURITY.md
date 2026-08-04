# Security model

## Identity and tenancy

- Hosted sessions use a versioned JSON payload signed with HMAC-SHA-256 and stored in an
  httpOnly cookie. Expiry and email are validated after signature verification.
- Safe legacy-cookie support reads the server-appended expiry after the final delimiter,
  preventing delimiter injection from overriding expiry.
- Gateway identity headers are trusted only when the deployment explicitly declares a
  trusted gateway. Local identity requires an explicit non-production opt-in.
- Operational rows are selected from the server-resolved workspace, not a caller-supplied
  workspace ID.
- Public mode resolves `QUEUEPROOF_PUBLIC_WORKSPACE_ID` exactly. Without it, only a true
  singleton workspace is accepted; an ambiguous multi-workspace database fails closed.

## Public sandbox boundary

The public actor can inspect shared evidence, ask grounded questions, review queue
packets, and create shared proposals. It cannot:

- configure HydraDB credentials;
- create, discover, configure, sync, or verify connectors;
- create databases or upload documents;
- enumerate HydraDB databases/providers, call the raw `/api/query` surface, create workspaces, or
  trigger document-status refreshes;
- mint or revoke MCP tokens; or
- approve/execute an external provider write.

Each sensitive route invokes the private-control guard server-side; hiding a browser
button is not the security boundary.

The remaining public write/cost paths are deliberately bounded: `/api/ask` allows 12
requests per minute, queue generation allows 3 per 5 minutes, and proposal creation
allows 8 per 10 minutes. Limits are recorded in the durable audit ledger. The shared
workspace also accepts at most 50 pending proposals before owner review is required.

## Secrets

- HydraDB credentials are encrypted at rest with AES-GCM and a random IV; only a
  fingerprint is returned to the browser.
- Production configuration requires an encryption key and a complete Turso URL/token
  pair, and rejects test/local identity behavior.
- Redaction covers bearer values, common provider-token formats, private keys,
  credential URLs, query tokens, and generic key/value credentials.
- No real credential belongs in source, fixture, output, screenshot, or documentation.

The 3 August scan found zero matching files across the final release worktree and complete
pre-release history for AWS, GitHub, OpenAI, Slack, Linear, and private-key patterns. The
scanner emitted paths only, never candidate values. See `audit/secret-scan-2026-08-03.md`.

## Retrieval and ingestion

- Only `data_verified` connectors can enter retrieval or queue generation.
- Sources must match the connector ID or a selected resource ID. Provider-name equality
  alone is rejected; uploaded-document evidence must match its HydraDB source ID.
- Sources and chunks join by HydraDB identity, never by response position.
- URLs are HTTPS-only and reject local, private, link-local, CGNAT, IPv6-local, and
  mapped-private destinations.
- Upload size is rejected from `Content-Length` before multipart parsing when possible.
  PDF uses signature validation; text rejects NULs and invalid UTF-8.
- SHA-256 plus a database uniqueness constraint makes duplicate upload handling race-safe.
- Retrieved prompt-injection-shaped instructions are data, not authority, and are
  excluded from ranking/action compilation.

## Actions

- External writes are proposal-first, evidence-linked, risk-labelled, and explicitly
  approved.
- Proposal idempotency is scoped per workspace.
- Web and MCP proposals must resolve every evidence ID inside the same workspace. MCP
  proposals are limited to Linear `create_issue`, must carry those IDs in the exact
  provider description, and are conservatively labelled high risk unless critical.
- Approval revalidates provider, action type, payload bounds, evidence ownership, and
  owner role immediately before the at-most-once execution claim.
- The action integrity migration enforces at most one approval and one execution row per
  proposal while preserving the strongest historical record.
- An execution row is claimed before provider I/O. Concurrent approvals cannot both call
  the provider.
- Success requires a stored provider response ID; failure text is persisted for audit.

## MCP

- MCP tokens are random bearer values stored only as hashes.
- Tokens carry scopes, expiry, revocation, client identity, and audience.
- The MCP endpoint requires the `queueproof-mcp` audience, so a valid token minted for a
  different service is rejected.
- Public sandbox visitors cannot mint or revoke tokens.

## Verification

```bash
pnpm test:security
pnpm test:mcp
pnpm test
```

Also run typecheck, lint, build, deployment checks, dependency audit, and a
worktree-plus-history secret scan before release. Exact test totals belong in the final CI
receipt rather than this long-lived security model.
